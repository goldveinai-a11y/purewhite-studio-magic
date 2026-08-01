import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { removeBackgroundWithRembg, type RemoveBackgroundInput } from "./process-image.server";

/**
 * Best-effort abuse brake for calls that bypass the UI entirely (e.g. a
 * script replaying this endpoint directly). Paid-tier requests always carry
 * a Supabase Bearer token (attached automatically by attachSupabaseAuth) and
 * are ALREADY metered precisely by reservePhotos()'s atomic Postgres check
 * before this ever runs, so they skip this limiter untouched — a Pro user's
 * 50-photo batch is never affected.
 *
 * Requests with no Bearer token (the anonymous free-tier path) are capped
 * per source IP. This is intentionally coarse, not a security boundary: it
 * is an in-memory, per-instance window that resets on redeploy and does not
 * coordinate across multiple server instances/regions. Its job is to blunt
 * a casual "copy the fetch call from devtools and loop it" script, not to
 * stop a determined, distributed attacker — that would require a durable
 * store (e.g. a Supabase table keyed by IP) as a follow-up if it's ever
 * actually exploited.
 */
const ANON_WINDOW_MS = 10 * 60 * 1000;
// Free tier allows 3 photos, but users retry, re-upload, and open the tool
// more than once in a 10-minute window. 12 was far too low — a single
// legitimate free user could trip it, and (worse) when the IP couldn't be
// resolved everyone shared one "unknown" bucket and collectively hit the
// cap after 12 photos site-wide. Raised to a level that only a scripted
// abuser reaches, and the unknown-IP case now bypasses the limiter instead
// of trapping real users in a shared bucket.
const ANON_MAX_PER_WINDOW = 40;
const anonHits = new Map<string, number[]>();

function anonRateLimitOk(ip: string): boolean {
  const now = Date.now();
  const hits = (anonHits.get(ip) ?? []).filter((t) => now - t < ANON_WINDOW_MS);
  if (hits.length >= ANON_MAX_PER_WINDOW) {
    anonHits.set(ip, hits);
    return false;
  }
  hits.push(now);
  anonHits.set(ip, hits);
  // Opportunistic cleanup so the map doesn't grow unbounded over the
  // process lifetime.
  if (anonHits.size > 5000) {
    for (const [key, times] of anonHits) {
      if (times.every((t) => now - t >= ANON_WINDOW_MS)) anonHits.delete(key);
    }
  }
  return true;
}

// Must match the client-side MAX_FILE_BYTES (20MB) and the "Max 20MB per
// file" promise in the UI. Base64 inflates bytes by ~33%, so a 20MB binary
// arrives as ~27MB of string — size the server ceiling from that, not from
// an 11MB assumption that silently rejected valid in-spec uploads.
const MAX_IMAGE_URL_LENGTH = 28_000_000;

export const removeBackground = createServerFn({ method: "POST" })
  .inputValidator((input: unknown): RemoveBackgroundInput => {
    if (
      !input ||
      typeof input !== "object" ||
      typeof (input as { imageUrl?: unknown }).imageUrl !== "string"
    ) {
      throw new Error("imageUrl (string) is required");
    }
    const { imageUrl } = input as { imageUrl: string };
    if (imageUrl.length > MAX_IMAGE_URL_LENGTH) {
      throw new Error("Image payload too large (max 20MB per file)");
    }
    return { imageUrl };
  })
  .handler(async ({ data }) => {
    const key = process.env.FALAI_KEY;
    if (!key) throw new Error("FALAI_KEY is not configured");

    try {
      const request = getRequest();
      const hasAuth = !!request?.headers?.get("authorization");
      if (!hasAuth) {
        const ip =
          request?.headers?.get("cf-connecting-ip") ??
          request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          null;
        // CRITICAL: only rate-limit when we can actually identify the caller.
        // If the platform doesn't forward an IP header, every anonymous
        // visitor would otherwise collapse into one shared bucket and the
        // whole site would lock out after ~40 photos total. A missing IP
        // means "can't attribute" — so we let the request through rather
        // than punishing real users for an infrastructure gap.
        if (ip && !anonRateLimitOk(ip)) {
          throw new Error(
            "Too many requests from this connection. Please slow down or sign up for a Pro account.",
          );
        }
      }
    } catch (err) {
      // If it's our own rate-limit error, propagate it; any other failure
      // reading the request (e.g. in a non-HTTP context) must never block
      // a legitimate photo.
      if (err instanceof Error && err.message.startsWith("Too many requests")) throw err;
    }

    return removeBackgroundWithRembg({ apiKey: key, ...data });
  });
