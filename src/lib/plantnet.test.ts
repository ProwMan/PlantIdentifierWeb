import { describe, expect, it } from "vitest";
import { parsePlantNetResponse, plantNetSuggestions } from "./plantnet";

function result(overrides: Record<string, unknown> = {}) {
  return {
    score: 0.91,
    species: {
      scientificNameWithoutAuthor: "Monstera deliciosa Liebm.",
      scientificName: "Monstera deliciosa Liebm.",
      commonNames: ["Swiss cheese plant"],
    },
    images: [{ url: { s: "https://example.test/s.jpg", m: "https://example.test/m.jpg" } }],
    gbif: { id: 2866145 },
    ...overrides,
  };
}

describe("parsePlantNetResponse", () => {
  it("treats 404 'Species not found' as an empty result, not an error", () => {
    // This is what Pl@ntNet returns for a photo of a chair. It must reach the UI as the
    // friendly "Plant Not Found" screen instead of a technical failure.
    expect(parsePlantNetResponse(404, JSON.stringify({ message: "Species not found" }))).toEqual(
      [],
    );
  });

  it("still throws for real upstream failures", () => {
    expect(() => parsePlantNetResponse(429, "quota exceeded")).toThrow(/Pl@ntNet 429/);
    expect(() => parsePlantNetResponse(500, "boom")).toThrow(/Pl@ntNet 500/);
  });

  it("throws a readable error when a 200 body is not JSON", () => {
    expect(() => parsePlantNetResponse(200, "<html>oops</html>")).toThrow(/could not be read/);
  });

  it("maps a successful response to suggestions", () => {
    const suggestions = parsePlantNetResponse(200, JSON.stringify({ results: [result()] }));

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      name: "Monstera deliciosa Liebm.",
      commonNames: ["Swiss cheese plant"],
      probability: 0.91,
      thumbnail: "https://example.test/s.jpg",
      wikiUrl: "https://www.gbif.org/species/2866145",
    });
  });

  it("ignores matches below the confidence threshold", () => {
    const suggestions = parsePlantNetResponse(
      200,
      JSON.stringify({ results: [result({ score: 0.59 })] }),
    );

    expect(suggestions).toEqual([]);
  });
});

describe("plantNetSuggestions", () => {
  it("keeps at most three suggestions", () => {
    const payload = { results: [result(), result(), result(), result()] };

    expect(plantNetSuggestions(payload)).toHaveLength(3);
  });

  it("falls back to scientificName when the short name is absent", () => {
    const payload = {
      results: [
        result({
          species: { scientificName: "Ficus benjamina L.", commonNames: [] },
        }),
      ],
    };

    expect(plantNetSuggestions(payload)[0].name).toBe("Ficus benjamina L.");
  });

  it("survives malformed payloads instead of throwing", () => {
    expect(plantNetSuggestions(null)).toEqual([]);
    expect(plantNetSuggestions({})).toEqual([]);
    expect(plantNetSuggestions({ results: "nope" })).toEqual([]);
    expect(plantNetSuggestions({ results: [null, { score: 0.9 }] })).toEqual([]);
  });
});
