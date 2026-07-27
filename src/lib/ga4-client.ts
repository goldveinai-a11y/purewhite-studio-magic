/**
 * Client-side GA4 helpers.
 *
 * `purchase` is deliberately NOT fired from here. Revenue events are sent
 * server-side from the Stripe webhook (see ga4.server.ts) via the
 * Measurement Protocol — that firing point can't be blocked by an ad
 * blocker and only runs once Stripe has actually confirmed the charge, so
 * it's the source of truth for revenue. This file only tracks the
 * pre-revenue funnel (uploads, processing, paywall, begin_checkout).
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** Fire-and-forget custom/recommended event. No-op if gtag isn't loaded
 * (no Measurement ID configured yet, or the script was blocked) — tracking
 * must never be able to break the product. */
export function track(eventName: string, params?: Record<string, unknown>): void {
  try {
    window.gtag?.("event", eventName, params);
  } catch {
    // Analytics must never throw into the product's own error handling.
  }
}

/**
 * Reads the GA4 client_id from the `_ga` cookie GA itself sets
 * (format: GA1.1.<client_id_part1>.<client_id_part2>). This is what lets
 * the server-side `purchase` Measurement Protocol call (fired from the
 * Stripe webhook, with no browser context of its own) attribute revenue
 * back to the same visitor/session that gtag has been tracking — without
 * it, every server-fired purchase would look like a brand-new anonymous
 * user and traffic-source attribution for revenue would be lost.
 */
export function getGaClientId(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)_ga=([^;]+)/);
  if (!match) return null;
  const parts = match[1].split(".");
  if (parts.length < 4) return null;
  return `${parts[2]}.${parts[3]}`;
}
