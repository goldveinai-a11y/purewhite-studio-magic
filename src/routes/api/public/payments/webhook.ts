import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import type { Database } from "@/integrations/supabase/types";
import { sendGa4Purchase, type Ga4Item } from "@/lib/ga4.server";

const PRODUCT_NAMES: Record<string, string> = {
  pro: "PureWhite BG Pro (Monthly)",
  lifetime: "PureWhite BG Lifetime",
  extra_pack: "500 Photo Top-Up",
};

let _supabase: ReturnType<typeof createClient<Database>> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

async function markProcessed(eventId: string): Promise<boolean> {
  const { error } = await getSupabase()
    .from("stripe_events_processed")
    .insert({ event_id: eventId });
  if (error && !error.message.includes("duplicate")) {
    console.error("stripe_events_processed insert error:", error);
    return false;
  }
  return !error;
}

async function fireGa4Purchase(params: {
  transactionId: string;
  product: "pro" | "lifetime" | "extra_pack";
  amountTotal: number | null | undefined; // cents, from Stripe
  currency: string | null | undefined;
  gaClientId: string | undefined;
}) {
  if (typeof params.amountTotal !== "number") {
    console.warn("[ga4] purchase skipped — no amount on Stripe object", params.transactionId);
    return;
  }
  const items: Ga4Item[] = [
    {
      item_id: params.product,
      item_name: PRODUCT_NAMES[params.product] ?? params.product,
      price: params.amountTotal / 100,
      quantity: 1,
    },
  ];
  await sendGa4Purchase({
    // No GA cookie (analytics blocked, or checkout started outside a
    // tracked session) — Measurement Protocol still accepts a synthetic
    // id, so revenue is recorded even though it won't map to a specific
    // browsing session.
    clientId: params.gaClientId || `server.${params.transactionId}`,
    transactionId: params.transactionId,
    value: params.amountTotal / 100,
    currency: (params.currency ?? "usd").toUpperCase(),
    items,
  });
}

async function handleCheckoutCompleted(session: any) {
  const userId = session.metadata?.userId;
  const product = session.metadata?.product as
    | "pro"
    | "lifetime"
    | "extra_pack"
    | undefined;
  if (!userId || !product) {
    console.warn("checkout.session.completed missing metadata", { userId, product });
    return;
  }
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;

  // Pro is a subscription: Stripe settles its first charge on
  // customer.subscription.created below, not here, so the purchase event
  // fires there instead (and only there, once, on first creation).
  if (product === "lifetime" || product === "extra_pack") {
    await fireGa4Purchase({
      transactionId: session.id,
      product,
      amountTotal: session.amount_total,
      currency: session.currency,
      gaClientId: session.metadata?.gaClientId,
    });
  }

  if (product === "lifetime") {
    await getSupabase()
      .from("entitlements")
      .update({
        tier: "lifetime",
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  } else if (product === "extra_pack") {
    // atomic add via rpc-less path: fetch → add → update
    const { data: row } = await getSupabase()
      .from("entitlements")
      .select("extra_pack_balance")
      .eq("user_id", userId)
      .maybeSingle();
    const current = (row as { extra_pack_balance?: number } | null)?.extra_pack_balance ?? 0;
    await getSupabase()
      .from("entitlements")
      .update({
        extra_pack_balance: current + 500,
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  }
  // Pro is handled by customer.subscription.created below
}

async function handleSubscriptionUpsert(subscription: any, isNewSubscription: boolean) {
  const userId = subscription.metadata?.userId;
  if (!userId) return;
  const status = subscription.status;
  const active = status === "active" || status === "trialing";
  const item = subscription.items?.data?.[0];
  const periodEndUnix = item?.current_period_end ?? subscription.current_period_end;
  const periodEndIso = periodEndUnix
    ? new Date(periodEndUnix * 1000).toISOString()
    : null;
  await getSupabase()
    .from("entitlements")
    .update({
      tier: active || status === "past_due" || status === "unpaid" ? "pro" : "free",
      stripe_customer_id:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id,
      stripe_subscription_id: subscription.id,
      subscription_status: status,
      current_period_end: periodEndIso,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  // Fire purchase ONLY on genuine first creation of the subscription, never
  // on customer.subscription.updated (which fires for plan changes, renewal
  // bookkeeping, Stripe-internal syncs, etc. — treating every update as a
  // new sale would wildly overcount Pro revenue in GA4).
  if (isNewSubscription && active) {
    await fireGa4Purchase({
      transactionId: subscription.id,
      product: "pro",
      amountTotal: item?.price?.unit_amount,
      currency: item?.price?.currency,
      gaClientId: subscription.metadata?.gaClientId,
    });
  }
}

async function handleSubscriptionDeleted(subscription: any) {
  const userId = subscription.metadata?.userId;
  if (!userId) return;
  await getSupabase()
    .from("entitlements")
    .update({
      tier: "free",
      stripe_subscription_id: null,
      subscription_status: "canceled",
      current_period_end: null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

async function handleEvent(event: { id: string; type: string; data: { object: any } }) {
  const ok = await markProcessed(event.id);
  if (!ok) return; // duplicate — already processed

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object);
      break;
    case "customer.subscription.created":
      await handleSubscriptionUpsert(event.data.object, true);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpsert(event.data.object, false);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object);
      break;
    default:
      // ignore
      break;
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook received without valid env:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;
        try {
          const event = await verifyWebhook(request, env);
          await handleEvent(event);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});