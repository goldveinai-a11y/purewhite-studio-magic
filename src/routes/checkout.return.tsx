import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { getEntitlements } from "@/lib/payments.functions";

type Search = { session_id?: string; plan?: string };

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
    plan: typeof s.plan === "string" ? s.plan : undefined,
  }),
  component: ReturnPage,
  head: () => ({
    meta: [
      { title: "Payment complete — PureWhite BG" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const POLL_INTERVAL_MS = 700;
const MAX_WAIT_MS = 12_000;
// Top-ups don't change `tier` (only extra_pack_balance), so we can't detect
// completion by polling the same signal - give the webhook a slightly
// longer flat grace period instead of the old blind 2.5s.
const EXTRA_PACK_WAIT_MS = 4_000;

function ReturnPage() {
  const navigate = useNavigate();
  const { session_id, plan } = useSearch({ from: "/checkout/return" });
  const getEnt = useServerFn(getEntitlements);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!session_id) return;
    let cancelled = false;

    if (plan === "extra") {
      const t = setTimeout(() => {
        if (!cancelled) window.location.href = "/#studio-workspace";
      }, EXTRA_PACK_WAIT_MS);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }

    // Pro / Lifetime: poll actual server state instead of guessing a fixed
    // delay. The webhook that flips `tier` away from "free" can occasionally
    // take longer than a couple seconds (Stripe delivery + our own
    // processing) - redirecting before it lands showed a paying customer
    // their own studio looking like they never upgraded.
    const startedAt = Date.now();
    const poll = async () => {
      while (!cancelled) {
        try {
          const res = await getEnt();
          if ("entitlements" in res && res.entitlements.tier !== "free") {
            if (!cancelled) window.location.href = "/#studio-workspace";
            return;
          }
        } catch {
          // Transient auth/network hiccup right after redirect - keep
          // polling rather than giving up on a single failed check.
        }
        if (Date.now() - startedAt > MAX_WAIT_MS) {
          if (!cancelled) setTimedOut(true);
          return;
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, [session_id, plan, getEnt]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        {session_id ? (
          timedOut ? (
            <>
              <h1 className="font-display text-2xl font-bold">Almost there</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Stripe confirmed your payment, but your account is taking longer than usual to
                update. This is safe — refresh in a minute, or contact support if it persists.
              </p>
              <Button className="mt-6" onClick={() => window.location.reload()}>
                Refresh
              </Button>
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
                <Check className="h-7 w-7" />
              </div>
              <h1 className="font-display text-2xl font-bold">Payment complete</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Your account is being updated. Redirecting to the studio…
              </p>
              <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                One moment
              </div>
            </>
          )
        ) : (
          <>
            <h1 className="font-display text-2xl font-bold">Checkout status unknown</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We couldn't find your session. If you were charged, refresh in a moment.
            </p>
            <Button className="mt-6" onClick={() => navigate({ to: "/" })}>
              Go home
            </Button>
          </>
        )}
      </div>
    </div>
  );
}