import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
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

async function handleSubscriptionUpsert(subscription: any) {
  const userId = subscription.metadata?.userId;
  if (!userId) return;
  const status = subscription.status;
  const active = status === "active" || status === "trialing";
  await getSupabase()
    .from("entitlements")
    .update({
      tier: active ? "pro" : "free",
      stripe_customer_id:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id,
      stripe_subscription_id: subscription.id,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

async function handleSubscriptionDeleted(subscription: any) {
  const userId = subscription.metadata?.userId;
  if (!userId) return;
  await getSupabase()
    .from("entitlements")
    .update({
      tier: "free",
      stripe_subscription_id: null,
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
    case "customer.subscription.updated":
      await handleSubscriptionUpsert(event.data.object);
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