import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { parsePlantNetResponse, type PlantSuggestion } from "@/lib/plantnet";

export type { PlantSuggestion };

// Profanity filter list
const VULGARITIES = [
  "fuck",
  "shit",
  "ass",
  "bitch",
  "dick",
  "pussy",
  "bastard",
  "cunt",
  "nigger",
  "faggot",
  "slut",
  "whore",
  "cock",
  "vagina",
  "anus",
  "asshole",
  "retard",
  "rape",
  "sex",
  "porn",
  "cum",
  "tit",
];

function containsProfanity(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[^a-z0-9]/g, "");
  return VULGARITIES.some((word) => normalized.includes(word));
}

// x.yy format: x is 1-6, yy is 01-18
const CLASS_REGEX = /^[1-6]\.(0[1-9]|1[0-8])$/;

type CreateHash = typeof import("node:crypto").createHash;

/**
 * Deterministic RFC 4122 UUID derived from `seed`.
 *
 * `users.id` and `discoveries.user_id` are Postgres `UUID` columns
 * (see supabase/migrations/001_initial_schema.sql), so the id we derive from a
 * student's name + class MUST be UUID-shaped. A raw 32-char MD5 hex string is
 * rejected by Postgres with SQLSTATE 22P02 ("invalid input syntax for type uuid"),
 * which is what broke sign-in. Reusing MD5 keeps the id stable per student, and
 * setting the version/variant nibbles keeps the value a well-formed UUID.
 */
function deterministicUuid(seed: string, createHash: CreateHash): string {
  const bytes = Buffer.from(createHash("md5").update(seed).digest());
  bytes[6] = (bytes[6] & 0x0f) | 0x30; // version 3 (MD5-based)
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Server-only env access. Fails loudly with an actionable message instead of
// silently handing `undefined` to a client library.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing server env var ${name}. Add it to .env.local for local dev, or to your hosting provider's environment variables.`,
    );
  }
  return value;
}

// Service-role client: bypasses RLS, so it must never be reachable from the browser.
// Only used inside createServerFn handlers.
async function supabaseAdmin() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const loginUser = createServerFn({ method: "POST" })
  .validator(
    z.object({
      fullName: z.string().min(2).max(50),
      className: z.string().refine((val) => CLASS_REGEX.test(val), {
        message: "Invalid class format. Use x.yy (e.g., 1.01 to 6.18)",
      }),
    }),
  )
  .handler(async ({ data }) => {
    const { createHash } = await import("node:crypto");

    const { fullName, className } = data;

    if (containsProfanity(fullName)) {
      throw new Error("Inappropriate name detected. Please use your real name.");
    }

    // Stable id per (name, class) so a student always maps to the same row.
    const uid = deterministicUuid(
      `${fullName.toLowerCase().trim()}-${className.toLowerCase().trim()}`,
      createHash,
    );

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

// Server function to upsert user profile (runs server-side with service role, bypasses RLS)
export const upsertUser = createServerFn({ method: "POST" })
  .validator(
    z.object({
      // Must be a UUID: users.id is a Postgres `uuid` column, and the id is derived
      // deterministically from name + class in loginUser.
      uid: z.string().uuid(),
      fullName: z.string().min(2).max(50),
      className: z.string().refine((val) => CLASS_REGEX.test(val), {
        message: "Invalid class format. Use x.yy (e.g., 1.01 to 6.18)",
      }),
    }),
  )
  .handler(async ({ data }) => {
    const admin = await supabaseAdmin();

    const { error } = await admin.from("users").upsert({
      id: data.uid,
      full_name: data.fullName.trim(),
      class_name: data.className.trim(),
      last_login: new Date().toISOString(),
    });

    if (error) throw error;
    return { success: true };
  });

// Discovery writes go through the service role because this app authenticates with its own
// name + class scheme rather than Supabase Auth: `auth.uid()` is always NULL for the
// browser's anon key, so the schema's `auth.uid() = user_id` INSERT policy can never pass
// for a client-side insert. Computing points and the daily cap here also stops the browser
// from awarding itself points.
export const recordDiscovery = createServerFn({ method: "POST" })
  .validator(
    z.object({
      userId: z.string().uuid(),
      scientificName: z.string().min(1).max(200),
      commonName: z.string().min(1).max(200),
      confidence: z.number().min(0).max(1),
    }),
  )
  .handler(async ({ data }) => {
    const admin = await supabaseAdmin();

    const { data: profile, error: profileError } = await admin
      .from("users")
      .select("display_name")
      .eq("id", data.userId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) throw new Error("Your profile could not be found. Please sign in again.");

    // New species vs rediscovery. Compared case-insensitively against every discovery this
    // student has ever logged — the previous client-side check only looked at the 100 most
    // recent rows, so an older species was wrongly scored as new (10 points instead of 1).
    // PostgREST caps a single response at 1000 rows, so page through rather than trusting
    // one page, and stop as soon as a match is found.
    const PAGE_SIZE = 1000;
    const target = data.scientificName.trim().toLowerCase();
    let foundBefore = false;

    for (let from = 0; !foundBefore; from += PAGE_SIZE) {
      const { data: page, error: pageError } = await admin
        .from("discoveries")
        .select("scientific_name")
        .eq("user_id", data.userId)
        .order("scientific_name")
        .range(from, from + PAGE_SIZE - 1);

      if (pageError) throw pageError;
      if (!page || page.length === 0) break;

      foundBefore = page.some((row) => row.scientific_name?.trim().toLowerCase() === target);

      if (page.length < PAGE_SIZE) break;
    }

    const points = foundBefore ? 1 : 10;

    const { data: limitCheck, error: limitError } = await admin.rpc("check_daily_limits", {
      p_user_id: data.userId,
      p_points: points,
    });

    if (limitError) throw limitError;

    const verdict = limitCheck?.[0];
    if (verdict && verdict.allowed === false) {
      return { ok: false as const, reason: verdict.message || "Daily limit reached" };
    }

    const { error: insertError } = await admin.from("discoveries").insert({
      user_id: data.userId,
      student: profile.display_name,
      scientific_name: data.scientificName.trim(),
      common_name: data.commonName.trim(),
      points,
      confidence: data.confidence,
      found_at: new Date().toISOString(),
    });

    if (insertError) throw insertError;

    return { ok: true as const, isNew: !foundBefore, points };
  });

export const identifyPlant = createServerFn({ method: "POST" })
  .validator(inputSchema)
  .handler(async ({ data }): Promise<{ suggestions: PlantSuggestion[]; mocked: boolean }> => {
    const apiKey = requireEnv("PLANTNET_API_KEY");

    const { blob, filename } = dataUrlToBlob(data.imageDataUrl);
    const form = new FormData();
    form.append("images", blob, filename);
    form.append("organs", "auto");

    const url = `https://my-api.plantnet.org/v2/identify/all?api-key=${encodeURIComponent(
      apiKey,
    )}&include-related-images=true&no-reject=false&lang=en`;

    const res = await fetch(url, { method: "POST", body: form });

    // Status handling lives in src/lib/plantnet.ts: 404 ("Species not found") becomes an
    // empty list so the UI shows "Plant Not Found"; other failures still throw.
    const suggestions: PlantSuggestion[] = parsePlantNetResponse(res.status, await res.text());

    return { suggestions, mocked: false };
  });
