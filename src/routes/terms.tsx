import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms of Service — PureWhite BG" },
      {
        name: "description",
        content:
          "Terms of Service for PureWhite BG, the pure white background studio for e-commerce sellers.",
      },
      { property: "og:title", content: "Terms of Service — PureWhite BG" },
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
        <div className="prose-legal mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">
          {children}
        </div>
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

function TermsPage() {
  return (
    <LegalShell eyebrow="Legal · Terms" title="Terms of Service" updated="July 28, 2026">
      <p>
        These Terms of Service ("Terms") govern your access to and use of purewhitebg.com
        ("Website") and the PureWhite BG background-editing service ("Product"), operated by Dmitrii
        Bosiachenko, autónomo registered in Spain (NIF: Z3795401S) ("we," "us," or "PureWhite BG").
      </p>
      <p>
        By accessing the Website or purchasing a plan, you agree to these Terms. If you do not agree,
        do not use the Website or purchase a plan.
      </p>
      <p className="rounded-lg border border-border bg-muted/40 p-4">
        <strong>How your images are handled.</strong> Background removal runs in your browser. The
        image data sent to our processing provider is used only to produce your edited photo and is
        not stored on our servers. See our{" "}
        <Link to="/privacy" className="text-primary underline">
          Privacy Policy
        </Link>{" "}
        for exactly how that works.
      </p>

      <H n="01">The product</H>
      <p>
        PureWhite BG lets you upload product photos and returns edited images on a pure white
        (#FFFFFF) background, resized and framed to marketplace requirements (such as Amazon's
        1000×1000px, 85%+ frame-fill rules), with an optional grounding shadow. Each photo is scored
        against those compliance rules before you download it.
      </p>
      <p>
        Processing happens in your browser and through our image provider. Your source and result
        images are not saved to our servers; if you leave or refresh the page before downloading,
        the results are gone and must be regenerated.
      </p>

      <H n="02">Acceptable use</H>
      <p>
        You confirm that you have the right to upload and edit the images you submit, and that you
        will not use the Product for unlawful content or in violation of any third party's
        intellectual-property or other rights. We reserve the right to suspend accounts we reasonably
        believe are being used unlawfully.
      </p>

      <H n="03">Plans, purchase, and payment</H>
      <p>Purchases are processed by Stripe. We are the seller and merchant of record.</p>
      <p>
        <strong>Free tier.</strong> A limited number of free photo exports, with no account or card
        required.
      </p>
      <p>
        <strong>Pro Seller Pass — recurring subscription.</strong> A monthly subscription for
        expanded processing. It renews automatically at the then-current monthly price until you
        cancel.
      </p>
      <p>
        <strong>Lifetime Credit Pass — one-time.</strong> A one-time payment for a fixed allowance of
        photo credits. No subscription, no recurring charge.
      </p>
      <p>
        <strong>Credit top-ups — one-time.</strong> Additional photo credits purchasable as a
        one-time payment.
      </p>
      <p>
        Current prices for each plan are shown on the Website at checkout — that page is the
        authoritative source of pricing, not this document. Processing allowances are subject to
        reasonable fair-use limits to prevent abuse. You are responsible for providing accurate
        information at checkout, including a valid email address.
      </p>

      <H n="04">Managing and cancelling your subscription</H>
      <p>
        You can view and cancel an active subscription at any time from the "Manage subscription"
        link in the studio, via Stripe's secure billing portal. Cancelling stops future renewals; it
        does not retroactively refund charges already made except as described in our{" "}
        <Link to="/refund" className="text-primary underline">
          Refund Policy
        </Link>
        .
      </p>

      <H n="05">License</H>
      <p>
        <strong>What you can do:</strong> use your edited images for your own commercial and personal
        purposes, including e-commerce listings (a commercial license is included with paid plans).
      </p>
      <p>
        <strong>What you cannot do:</strong> resell, sublicense, or redistribute the service itself;
        use the Website, its content, or its outputs to build a substantially similar competing
        product; remove or alter any copyright, trademark, or attribution notices; or attempt to
        disrupt, scrape, or reverse-engineer the service.
      </p>

      <H n="06">Third-party services</H>
      <p>The Product relies on third-party services we don't control, including:</p>
      <ul className="ml-5 list-disc space-y-1">
        <li>Stripe — payment processing and subscription billing</li>
        <li>fal.ai / Bria — image background removal</li>
        <li>Supabase — account authentication and storing your account and entitlement data</li>
      </ul>
      <p>
        If a provider changes in ways that affect the Product, we'll make reasonable efforts to keep
        the service running but don't guarantee continued functionality.
      </p>

      <H n="07">Disclaimer of warranties</H>
      <p>
        The Product is provided "as is" and "as available" without warranties of any kind, express or
        implied, including merchantability, fitness for a particular purpose, or non-infringement. We
        do not warrant that the Product will be uninterrupted, secure, or error-free, or that a
        compliance "pass" guarantees any marketplace will accept a given listing — marketplace
        policies are set and enforced solely by those marketplaces and can change at any time.
      </p>

      <H n="08">Limitation of liability</H>
      <p>
        To the maximum extent permitted by law, our total liability for any claim arising out of or
        relating to these Terms or the Product is limited to the amount you paid us in the 12 months
        preceding the claim. We are not liable for any indirect, incidental, consequential, special,
        or punitive damages, including lost profits, lost data, lost sales, or loss of opportunity.
      </p>
      <p>
        <strong>Consumer protection notice:</strong> the limitations above do not exclude or limit
        our liability for fraud, gross negligence, willful misconduct, death or personal injury
        caused by our negligence, or any other liability that cannot be excluded under Spanish or EU
        consumer protection law.
      </p>

      <H n="09">Intellectual property</H>
      <p>
        The Website, including its design, content, and software, is owned by Dmitrii Bosiachenko and
        protected by Spanish, EU, and international copyright law. "PureWhite BG" and its branding are
        our trademarks. Unauthorized use is prohibited.
      </p>

      <H n="10">Termination</H>
      <p>
        We may suspend or terminate your access if you breach these Terms. Termination does not
        entitle you to a refund unless required by our Refund Policy. Sections 07, 08, 09, and 12
        survive termination.
      </p>

      <H n="11">Changes to these terms</H>
      <p>
        We may update these Terms from time to time. Material changes affecting your rights will be
        communicated by email where we have your address. Continued use after changes constitutes
        acceptance of the updated Terms.
      </p>

      <H n="12">Governing law and dispute resolution</H>
      <p>
        These Terms are governed by the laws of Spain, without regard to its conflict of laws
        principles. Any dispute shall be resolved by the competent courts of Oviedo, Asturias, Spain,
        unless mandatory consumer protection law assigns jurisdiction to the courts of your country
        of residence. EU consumers may also use the European Commission's Online Dispute Resolution
        platform.
      </p>

      <H n="13">Contact</H>
      <p>
        Dmitrii Bosiachenko
        <br />
        Autónomo (registered in Spain)
        <br />
        NIF: Z3795401S
        <br />
        Calle Manuel Pedregal 17, 5°B
        <br />
        33001 Oviedo, Asturias, Spain
        <br />
        <a href="mailto:hello@purewhitebg.com" className="text-primary underline">
          hello@purewhitebg.com
        </a>
      </p>
    </LegalShell>
  );
}
