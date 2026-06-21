import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PlantSuggestion = {
  name: string;
  commonNames: string[];
  probability: number;
  thumbnail?: string;
  wikiUrl?: string;
};

// Profanity filter list - User can expand this
const VULGARITIES = [
  "fuck", "shit", "ass", "bitch", "dick", "pussy", "bastard", "cunt", 
  "nigger", "faggot", "slut", "whore", "cock", "vagina", "anus",
  "asshole", "retard", "rape", "sex", "porn", "cum", "tit"
];

function containsProfanity(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[^a-z0-9]/g, "");
  return VULGARITIES.some(word => normalized.includes(word));
}

// x.yy format: x is 1-6, yy is 01-18
const CLASS_REGEX = /^[1-6]\.(0[1-9]|1[0-8])$/;

export const loginUser = createServerFn({ method: "POST" })
  .validator(z.object({ 
    fullName: z.string().min(2).max(50),
    className: z.string().refine((val) => CLASS_REGEX.test(val), {
      message: "Invalid class format. Use x.yy (e.g., 1.01 to 6.18)"
    })
  }))
  .handler(async ({ data }) => {
    const crypto = await import("node:crypto");
    
    const { fullName, className } = data;

    if (containsProfanity(fullName)) {
      throw new Error("Inappropriate name detected. Please use your real name.");
    }

    // Generate a consistent UID based on name and class
    const uid = crypto.createHash("md5")
      .update(`${fullName.toLowerCase().trim()}-${className.toLowerCase().trim()}`)
      .digest("hex");

    return { uid, displayName: `${fullName.trim()} (${className.trim()})` };
  });

const inputSchema = z.object({
  imageDataUrl: z.string().min(32).max(15_000_000),
});

function dataUrlToBlob(dataUrl: string): { blob: Blob; filename: string } {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!match) throw new Error("Invalid image data URL");
  const mime = match[1];
  const b64 = match[2];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ext = mime.includes("png") ? "png" : "jpg";
  return { blob: new Blob([bytes], { type: mime }), filename: `plant.${ext}` };
}

export const identifyPlant = createServerFn({ method: "POST" })
  .validator(inputSchema)
  .handler(async ({ data }): Promise<{ suggestions: PlantSuggestion[]; mocked: boolean }> => {
    const apiKey = process.env.PLANTNET_API_KEY;

    if (!apiKey) {
      throw new Error("PLANTNET_API_KEY is not configured on the server.");
    }

    const { blob, filename } = dataUrlToBlob(data.imageDataUrl);
    const form = new FormData();
    form.append("images", blob, filename);
    form.append("organs", "auto");

    const url = `https://my-api.plantnet.org/v2/identify/all?api-key=${encodeURIComponent(
      apiKey,
    )}&include-related-images=true&no-reject=false&lang=en`;

    const res = await fetch(url, { method: "POST", body: form });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Pl@ntNet ${res.status}: ${text.slice(0, 300)}`);
    }

    const json = (await res.json()) as any;

    const suggestions: PlantSuggestion[] = (json.results ?? [])
      .filter((r: any) => r.score >= 0.6)
      .slice(0, 3)
      .map((r: any) => ({
        name: r.species.scientificNameWithoutAuthor ?? r.species.scientificName ?? "Unknown",
        commonNames: r.species.commonNames ?? [],
        probability: r.score,
        thumbnail: r.images?.[0]?.url?.s ?? r.images?.[0]?.url?.m,
        wikiUrl: r.gbif?.id ? `https://www.gbif.org/species/${r.gbif.id}` : undefined,
      }));

    return { suggestions, mocked: false };
  });
