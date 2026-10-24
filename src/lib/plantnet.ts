// Pl@ntNet response handling, kept pure so it can be tested without the network.
//
// The important case is "no match": Pl@ntNet answers a photo it cannot identify with
// HTTP 404 and {"message":"Species not found"}. That is an ordinary outcome (the student
// photographed a chair), not an outage, so it must become an empty suggestion list and let
// the app show "Plant Not Found" instead of a technical error screen.

export type PlantSuggestion = {
  name: string;
  commonNames: string[];
  probability: number;
  thumbnail?: string;
  wikiUrl?: string;
};

type PlantNetImage = { url?: { s?: string; m?: string } };

type PlantNetResult = {
  score: number;
  species: {
    scientificNameWithoutAuthor?: string;
    scientificName?: string;
    commonNames?: string[];
  };
  images?: PlantNetImage[];
  gbif?: { id?: number | string };
};

const MIN_CONFIDENCE = 0.6;
const MAX_SUGGESTIONS = 3;

function asResults(payload: unknown): PlantNetResult[] {
  if (!payload || typeof payload !== "object") return [];
  const results = (payload as { results?: unknown }).results;
  return Array.isArray(results) ? (results as PlantNetResult[]) : [];
}

/** Maps a parsed Pl@ntNet payload to the suggestions the UI renders. */
export function plantNetSuggestions(payload: unknown): PlantSuggestion[] {
  return asResults(payload)
    .filter((result) => result?.species && typeof result.score === "number")
    .filter((result) => result.score >= MIN_CONFIDENCE)
    .slice(0, MAX_SUGGESTIONS)
    .map((result) => ({
      name:
        result.species.scientificNameWithoutAuthor ?? result.species.scientificName ?? "Unknown",
      commonNames: result.species.commonNames ?? [],
      probability: result.score,
      thumbnail: result.images?.[0]?.url?.s ?? result.images?.[0]?.url?.m,
      wikiUrl: result.gbif?.id ? `https://www.gbif.org/species/${result.gbif.id}` : undefined,
    }));
}

/**
 * Turns an HTTP status plus raw body into suggestions.
 *
 * - 404 => []                       (Pl@ntNet "Species not found"; show the not-found screen)
 * - other non-2xx => throw          (real failure: quota, bad key, upstream outage)
 * - 2xx => filtered suggestions     (below-confidence matches are not suggestions)
 */
export function parsePlantNetResponse(status: number, bodyText: string): PlantSuggestion[] {
  if (status === 404) return [];

  if (status < 200 || status >= 300) {
    throw new Error(`Pl@ntNet ${status}: ${bodyText.slice(0, 300)}`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    throw new Error("Pl@ntNet returned a response that could not be read.");
  }

  return plantNetSuggestions(payload);
}
