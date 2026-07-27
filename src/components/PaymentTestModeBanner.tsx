const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-center text-sm font-medium text-destructive">
        Production checkout is not configured yet. Complete Stripe go-live in Payments before accepting real payments.
      </div>
    );
  }

  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full border-b border-amber-300/60 bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900">
        Test mode checkout. Payments here are not real until Stripe go-live is fully completed and the site is updated.
      </div>
    );
  }

  return null;
}