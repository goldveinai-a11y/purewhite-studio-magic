import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import {
  createProCheckout,
  createLifetimeCheckout,
  createExtraPackCheckout,
} from "@/lib/payments.functions";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { getGaClientId, track } from "@/lib/ga4-client";

export const Route = createFileRoute("/_authenticated/checkout/$plan")({
  component: CheckoutPage,
  head: () => ({
    meta: [
      { title: "Checkout — PureWhite BG" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function CheckoutPage() {
  const { plan } = useParams({ from: "/_authenticated/checkout/$plan" });
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const planCopy = {
    pro: {
      title: "PureWhite BG Pro",
      subtitle: "Ship more listings. Grow your sales.",
    },
    lifetime: {
      title: "PureWhite BG Lifetime",
      subtitle: "Pay once. Scale your sales forever.",
    },
    extra: {
      title: "500 Photo Top-Up",
      subtitle: "Additional credits for Pro and Lifetime accounts",
    },
  }[plan as "pro" | "lifetime" | "extra"];

  // Informational mirror of the live Stripe Price amounts, used only to
  // report `value`/`items` on the begin_checkout event — NOT the source of
  // truth for what's actually charged (that's the Stripe Price object
  // itself, looked up server-side by lookup_key). Keep in sync manually if
  // prices change in the Stripe Dashboard.
  const PLAN_VALUE: Record<"pro" | "lifetime" | "extra", number> = {
    pro: 6.99,
    lifetime: 29,
    extra: 9.99,
  };

  const options = useMemo(
    () => ({
      fetchClientSecret: async (): Promise<string> => {
        const returnUrl = `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}&plan=${plan}`;
        const environment = getStripeEnvironment();
        const gaClientId = getGaClientId() ?? undefined;
        const validPlan = (["pro", "lifetime", "extra"] as const).includes(
          plan as "pro" | "lifetime" | "extra",
        );
        if (validPlan) {
          track("begin_checkout", {
            currency: "USD",
            value: PLAN_VALUE[plan as "pro" | "lifetime" | "extra"],
            items: [
              {
                item_id: plan,
                item_name: planCopy?.title ?? plan,
                price: PLAN_VALUE[plan as "pro" | "lifetime" | "extra"],
                quantity: 1,
              },
            ],
          });
        }
        let result: { clientSecret: string } | { error: string };
        if (plan === "pro") {
          result = await createProCheckout({ data: { returnUrl, environment, gaClientId } });
        } else if (plan === "lifetime") {
          result = await createLifetimeCheckout({ data: { returnUrl, environment, gaClientId } });
        } else if (plan === "extra") {
          result = await createExtraPackCheckout({ data: { returnUrl, environment, gaClientId } });
        } else {
          throw new Error("Unknown plan");
        }
        if ("error" in result) {
          setError(result.error);
          throw new Error(result.error);
        }
        if (!result.clientSecret) throw new Error("Stripe did not return a client secret");
        return result.clientSecret;
      },
    }),
    [plan],
  );

  if (!["pro", "lifetime", "extra"].includes(plan)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Unknown plan</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: "/" })}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        {planCopy ? (
          <div className="mb-6 text-center">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {planCopy.title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{planCopy.subtitle}</p>
          </div>
        ) : null}
        {error ? (
          <div className="mx-auto max-w-xl rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : (
          <div id="checkout" className="mx-auto max-w-xl">
            <EmbeddedCheckoutProvider stripe={getStripe()} options={options}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        )}
      </div>
    </div>
  );
}