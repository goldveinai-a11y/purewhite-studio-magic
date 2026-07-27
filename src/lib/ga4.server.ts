/**
 * Server-side GA4 event sender (Measurement Protocol v2).
 *
 * Used exclusively for the `purchase` event, fired from the Stripe webhook
 * once Stripe has confirmed a charge. This is intentionally the ONLY path
 * that sends `purchase` to GA4 — do not also fire it client-side (e.g. on
 * the /checkout/return page): Measurement Protocol calls are not
 * deduplicated against gtag calls, so doing both double-counts revenue.
 *
 * Requires two env vars, both read from GA4 Admin → Data Streams →
 * [PureWhite BG Web stream] → Measurement Protocol API secrets:
 *   GA4_MEASUREMENT_ID   e.g. "G-XXXXXXXXXX" (same value as VITE_GA4_MEASUREMENT_ID)
 *   GA4_API_SECRET       created under "Measurement Protocol API secrets"
 */

export type Ga4Item = {
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
};

export type Ga4PurchaseEvent = {
  /** GA4 client_id captured client-side via the `_ga` cookie at
   * begin_checkout time, threaded through Stripe session metadata. Falls
   * back to a synthetic per-transaction id (still valid for Measurement
   * Protocol) if the visitor started checkout with analytics blocked -
   * revenue is still recorded, just not attributed to a browsing session. */
  clientId: string;
  transactionId: string;
  value: number;
  currency: string;
  items: Ga4Item[];
};

export async function sendGa4Purchase(evt: Ga4PurchaseEvent): Promise<void> {
  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) {
    // Analytics config is optional infrastructure - never let a missing
    // env var break the payment flow that calls this.
    console.warn("[ga4] GA4_MEASUREMENT_ID / GA4_API_SECRET not configured, skipping purchase event");
    return;
  }

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`;
  const body = {
    client_id: evt.clientId,
    events: [
      {
        name: "purchase",
        params: {
          transaction_id: evt.transactionId,
          value: evt.value,
          currency: evt.currency,
          items: evt.items,
        },
      },
    ],
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error("[ga4] Measurement Protocol request failed:", res.status, await res.text());
    }
  } catch (err) {
    // Never let an analytics outage break webhook processing (Stripe
    // retries webhooks on non-2xx; a GA hiccup must not trigger that).
    console.error("[ga4] Measurement Protocol request threw:", err);
  }
}
