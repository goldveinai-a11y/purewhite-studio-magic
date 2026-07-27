import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";

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

function ReturnPage() {
  const navigate = useNavigate();
  const { session_id } = useSearch({ from: "/checkout/return" });

  useEffect(() => {
    if (!session_id) return;
    const t = setTimeout(() => {
      window.location.href = "/#studio-workspace";
    }, 2500);
    return () => clearTimeout(t);
  }, [session_id]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        {session_id ? (
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