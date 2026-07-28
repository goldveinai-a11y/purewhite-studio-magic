import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/refund")({
  component: RefundPage,
  head: () => ({
    meta: [
      { title: "Refund Policy — PureWhite BG" },
      {
        name: "description",
        content: "Refund Policy for PureWhite BG plans and credit purchases.",
      },
      { property: "og:title", content: "Refund Policy — PureWhite BG" },
    ],
  }),
});

function LegalShell({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <span className="h-3 w-3 rounded-sm bg-primary-foreground" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">
              PureWhite <span className="text-primary">BG</span>
            </span>
          </Link>
          <Link to="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            ← Back to site
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>
        <h1 className="mt-2 font-display text-3xl font-bold md:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated · {updated}</p>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">{children}</div>
        <div className="mt-12 flex gap-4 border-t border-border/60 pt-6 text-sm text-muted-foreground">
          <Link to="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link to="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link to="/refund" className="hover:text-foreground">
            Refund
          </Link>
        </div>
      </main>
    </div>
  );
}

function H({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <h2 className="flex items-baseline gap-3 pt-4 font-display text-lg font-bold">
      <span className="text-sm font-semibold text-muted-foreground">{n}</span>
      {children}
    </h2>
  );
}

function RefundPage() {
  return (
    <LegalShell eyebrow="Legal · Refund" title="Refund Policy" updated="July 28, 2026">
      <p className="rounded-lg border border-border bg-muted/40 p-4">
        <strong>In short —</strong> try the service free before you pay. Because plans unlock digital
        processing immediately, paid purchases are generally non-refundable once used, but we handle
        billing errors, duplicate charges, and genuine technical failures fairly and in line with EU
        consumer law.
      </p>
      <p>
        This Refund Policy applies to purchases of PureWhite BG plans and credits, operated by Dmitrii
        Bosiachenko, autónomo registered in Spain (NIF: Z3795401S). It should be read together with
        our{" "}
        <Link to="/terms" className="text-primary underline">
          Terms of Service
        </Link>
        .
      </p>

      <H n="01">Try before you buy</H>
      <p>
        Every visitor gets free photo exports with no account or card required. We strongly recommend
        using the free tier to confirm the output meets your needs before purchasing a paid plan —
        this is the best way to avoid a purchase you don't want.
      </p>

      <H n="02">Digital goods & immediate access</H>
      <p>
        Paid plans and credit top-ups unlock digital processing capacity immediately upon purchase.
        Under EU consumer law, by starting to use that capacity you acknowledge that the service has
        begun and, to that extent, waive the standard 14-day withdrawal right for digital content
        that has already been supplied.
      </p>

      <H n="03">Subscriptions</H>
      <p>
        You can cancel the Pro Seller Pass at any time from the "Manage subscription" link in the
        studio (Stripe billing portal). Cancellation stops all future renewals. We do not provide
        partial refunds for the unused portion of a billing period already started, except where
        required by law.
      </p>

      <H n="04">When we do refund</H>
      <p>We will issue a refund in these cases:</p>
      <ul className="ml-5 list-disc space-y-1">
        <li>Duplicate or accidental charge for the same plan or top-up</li>
        <li>A billing amount that does not match the price shown at checkout</li>
        <li>
          A genuine technical failure on our side that prevented you from using what you paid for and
          that we were unable to resolve
        </li>
      </ul>
      <p>
        Dissatisfaction with an AI-generated edit's quality — where the free tier was available to
        preview that quality beforehand — is not on its own grounds for a refund, but we still want to
        hear about it; contact us and we'll do our best to help.
      </p>

      <H n="05">How to request a refund</H>
      <p>
        Email{" "}
        <a href="mailto:hello@purewhitebg.com" className="text-primary underline">
          hello@purewhitebg.com
        </a>{" "}
        from the address used at checkout, with your Stripe receipt or order ID and a short
        description of the issue. We aim to respond within 5 business days.
      </p>

      <H n="06">Your statutory rights</H>
      <p>
        Nothing in this policy limits any mandatory refund or withdrawal rights you have under Spanish
        or EU consumer protection law. EU consumers may also use the European Commission's Online
        Dispute Resolution platform.
      </p>

      <H n="07">Contact</H>
      <p>
        Dmitrii Bosiachenko · Autónomo (registered in Spain) ·{" "}
        <a href="mailto:hello@purewhitebg.com" className="text-primary underline">
          hello@purewhitebg.com
        </a>
      </p>
    </LegalShell>
  );
}
