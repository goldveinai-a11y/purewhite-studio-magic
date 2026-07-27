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

  const options = useMemo(
    () => ({
      fetchClientSecret: async (): Promise<string> => {
        const returnUrl = `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}&plan=${plan}`;
        const environment = getStripeEnvironment();
        let result: { clientSecret: string } | { error: string };
        if (plan === "pro") {
          result = await createProCheckout({ data: { returnUrl, environment } });
        } else if (plan === "lifetime") {
          result = await createLifetimeCheckout({ data: { returnUrl, environment } });
        } else if (plan === "extra") {
          result = await createExtraPackCheckout({ data: { returnUrl, environment } });
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
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: "/" })}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        {error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : (
          <div id="checkout">
            <EmbeddedCheckoutProvider stripe={getStripe()} options={options}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        )}
      </div>
    </div>
  );
}