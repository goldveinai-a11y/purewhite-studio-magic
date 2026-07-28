import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy — PureWhite BG" },
      {
        name: "description",
        content:
          "How PureWhite BG handles your data. Your product photos are processed and not stored on our servers. GDPR-compliant.",
      },
      { property: "og:title", content: "Privacy Policy — PureWhite BG" },
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

function PrivacyPage() {
  return (
    <LegalShell eyebrow="Legal · Privacy" title="Privacy Policy" updated="July 28, 2026">
      <p className="rounded-lg border border-border bg-muted/40 p-4">
        <strong>In short —</strong> the product photos you upload are processed to remove their
        background and are not stored on our servers. We keep your account and purchase data needed
        to run the service. Payments go through Stripe. We never sell your data, and you have full
        GDPR rights.
      </p>
      <p>
        This Privacy Policy describes how Dmitrii Bosiachenko, autónomo registered in Spain (NIF:
        Z3795401S) ("we," "us," or "PureWhite BG") collects, uses, and protects your personal
        information when you visit purewhitebg.com or purchase our product.
      </p>
      <p>
        This policy is provided in compliance with the EU General Data Protection Regulation (GDPR,
        Regulation 2016/679) and the Spanish Organic Law 3/2018 on Personal Data Protection and
        Guarantee of Digital Rights (LOPDGDD).
      </p>

      <p className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <strong>Your product photos, specifically.</strong> Background removal runs in your browser.
        The image data required for processing is sent to our image provider only to produce your
        edited photo and is not saved to our servers or storage — not before, during, or after
        processing. Your source and result images live only in your browser session and are cleared
        when you leave or refresh the page.
      </p>

      <H n="01">Data controller</H>
      <p>
        Controller: Dmitrii Bosiachenko (autónomo) · NIF: Z3795401S · Postal address in our{" "}
        <Link to="/terms" className="text-primary underline">
          Terms of Service
        </Link>{" "}
        ·{" "}
        <a href="mailto:hello@purewhitebg.com" className="text-primary underline">
          hello@purewhitebg.com
        </a>
      </p>

      <H n="02">What data we collect</H>
      <p>
        <strong>Product photos (not stored).</strong> When you upload a photo, it is transmitted
        securely and sent as image data to our image provider to generate your edited result. We do
        not save the image to our database or file storage at any point.
      </p>
      <p>
        <strong>Account and purchase data (stored).</strong> When you create an account or buy a
        plan, our processors collect and store your email address, plan type, subscription status,
        Stripe order/subscription IDs, and your processing-quota usage counters. We do not collect or
        store full payment card data — that is handled exclusively by Stripe.
      </p>
      <p>
        <strong>Website usage data.</strong> When you visit our Website, we collect standard
        analytics and advertising data (e.g. pages visited, device and browser type, approximate
        location from IP) via Google Analytics and, when our ads run, advertising pixels.
      </p>
      <p>
        <strong>Communication data.</strong> If you email us at hello@purewhitebg.com, we retain the
        content of your message for support and quality purposes.
      </p>

      <H n="03">Why we process your data</H>
      <ul className="ml-5 list-disc space-y-1">
        <li>Producing your edited images — performance of contract (Art. 6.1.b)</li>
        <li>Processing payment / subscription billing — performance of contract (Art. 6.1.b)</li>
        <li>Tax and accounting records — legal obligation (Art. 6.1.c), Spanish tax law</li>
        <li>Analytics and advertising measurement — consent / legitimate interest (Art. 6.1.a / 6.1.f)</li>
      </ul>

      <H n="04">How long we keep your data</H>
      <ul className="ml-5 list-disc space-y-1">
        <li>Product photos: not retained — cleared after processing</li>
        <li>Account data: kept while your account is active; deleted on request</li>
        <li>Purchase records: 6 years (Spanish tax law requires invoice retention)</li>
        <li>Email correspondence: 2 years after last contact</li>
        <li>Analytics data: 14 months</li>
      </ul>

      <H n="05">Who we share data with</H>
      <ul className="ml-5 list-disc space-y-1">
        <li>Stripe — payment and subscription billing</li>
        <li>fal.ai / Bria — receives image data to remove the background; not retained by us afterward</li>
        <li>Supabase — account authentication and database hosting</li>
        <li>Google (Analytics) — website analytics</li>
        <li>Advertising platforms — measurement when our ads run</li>
        <li>Spanish tax authorities (AEAT) — required reporting under Spanish tax law</li>
      </ul>
      <p>
        <strong>We never sell your personal data.</strong>
      </p>

      <H n="06">International data transfers</H>
      <p>
        Some processors (e.g. Stripe, Google) may process data in the United States. All such
        transfers rely on GDPR Chapter V safeguards (EU-US Data Privacy Framework and/or Standard
        Contractual Clauses).
      </p>

      <H n="07">Your rights</H>
      <p>Under GDPR and Spanish law, you have the right to access, rectify, erase, restrict, and port your data, to object to processing based on legitimate interest, and to withdraw consent at any time. You may also lodge a complaint with the Spanish Data Protection Authority (AEPD) at aepd.es.</p>
      <p>
        To exercise any of these rights, including deletion, email us at{" "}
        <a href="mailto:hello@purewhitebg.com" className="text-primary underline">
          hello@purewhitebg.com
        </a>
        . We respond within 30 days as required by GDPR.
      </p>

      <H n="08">Security</H>
      <p>
        We apply industry-standard security measures: TLS encryption in transit, encrypted storage at
        rest, and limited access on a need-to-know basis. Our payment processor Stripe is PCI-DSS
        Level 1 certified. If a data breach occurs that affects your data, we will notify you and the
        AEPD within 72 hours as required by GDPR Article 33.
      </p>

      <H n="09">Children</H>
      <p>
        PureWhite BG is not directed at children under 16. We do not knowingly collect personal data
        from children.
      </p>

      <H n="10">Changes to this policy</H>
      <p>
        We may update this Privacy Policy from time to time. Changes will be posted on this page with
        an updated date. Material changes affecting your rights will be communicated by email where we
        have your address.
      </p>

      <H n="11">Contact</H>
      <p>
        Dmitrii Bosiachenko · Autónomo (registered in Spain) ·{" "}
        <a href="mailto:hello@purewhitebg.com" className="text-primary underline">
          hello@purewhitebg.com
        </a>
      </p>
    </LegalShell>
  );
}
