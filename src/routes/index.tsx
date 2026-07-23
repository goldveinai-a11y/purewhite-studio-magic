import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Upload,
  Sparkles,
  Zap,
  ShieldCheck,
  Layers,
  Download,
  Package,
  Check,
  ArrowRight,
  Wand2,
  Image as ImageIcon,
  Lock,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import heroSneakerBefore from "@/assets/hero-sneaker-before.jpg.asset.json";
import heroSneakerAfter from "@/assets/hero-sneaker-after.jpg.asset.json";
import sellersHeadphonesBefore from "@/assets/sellers-headphones-before.jpg.asset.json";
import sellersHeadphonesAfter from "@/assets/sellers-headphones-after.jpg.asset.json";
import agenciesPerfumeBefore from "@/assets/agencies-perfume-before.jpg.asset.json";
import agenciesPerfumeAfter from "@/assets/agencies-perfume-after.jpg.asset.json";
import photographersWatchBefore from "@/assets/photographers-watch-before.jpg.asset.json";
import photographersWatchAfter from "@/assets/photographers-watch-after.jpg.asset.json";


export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "PureWhite BG — #1 Amazon Background Remover & Batch Editor" },
      {
        name: "description",
        content:
          "Batch remove backgrounds to 100% pure white (#FFFFFF) for Amazon, Shopify & eBay. Auto-resize to 1000x1000px, add soft shadows & export ZIP in 5 seconds.",
      },
      {
        name: "keywords",
        content:
          "amazon background remover, pure white background app, batch photo background isolation, 1000x1000 amazon image resizer, ebay white background generator",
      },
      {
        property: "og:title",
        content: "PureWhite BG — Instant #FFFFFF Backgrounds for E-Commerce",
      },
      {
        property: "og:description",
        content: "Convert product photos to 100% Amazon-compliant pure white listings in bulk.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://purewhitebg.com" },
    ],
    links: [{ rel: "canonical", href: "https://purewhitebg.com" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "PureWhite BG",
          operatingSystem: "All",
          applicationCategory: "DesignApplication",
          offers: {
            "@type": "Offer",
            price: "9.99",
            priceCurrency: "USD",
          },
          description:
            "Automated e-commerce background remover and Amazon 1000x1000px resizer for online sellers.",
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: "4.9",
            ratingCount: "1280",
          },
        }),
      },
    ],
  }),
});

function LandingPage() {
  const [sliderPos, setSliderPos] = useState(50);
  const [amazonPreset, setAmazonPreset] = useState(true);
  const [softShadow, setSoftShadow] = useState(true);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [singleDownloads, setSingleDownloads] = useState(0);
  const [amazonGuideOpen, setAmazonGuideOpen] = useState(false);

  const handleSingleDownload = () => {
    const next = singleDownloads + 1;
    if (next > 3) {
      setPaywallOpen(true);
      return;
    }
    setSingleDownloads(next);
  };

  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased">
      <Navbar onLaunch={() => setPaywallOpen(true)} />
      <Hero
        sliderPos={sliderPos}
        setSliderPos={setSliderPos}
        amazonPreset={amazonPreset}
        setAmazonPreset={setAmazonPreset}
        softShadow={softShadow}
        setSoftShadow={setSoftShadow}
        onBatchExport={() => setPaywallOpen(true)}
        onSingleDownload={handleSingleDownload}
      />
      <TrustBar />
      <ValueProps />
      <HowItWorks />
      <UseCases />
      <ComplianceTable />
      <Pricing onUpgrade={() => setPaywallOpen(true)} />
      <FAQ />
      <Footer onOpenAmazonGuide={() => setAmazonGuideOpen(true)} />
      <PaywallDialog open={paywallOpen} onOpenChange={setPaywallOpen} />
      <AmazonGuideDialog open={amazonGuideOpen} onOpenChange={setAmazonGuideOpen} />
    </div>
  );
}

function Navbar({ onLaunch }: { onLaunch: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <a href="#" className="flex items-center gap-2.5">
          <LogoMark />
          <span className="font-display text-lg font-bold tracking-tight">
            PureWhite <span className="text-primary">BG</span>
          </span>
        </a>
        <div className="hidden items-center gap-8 md:flex">
          {[
            ["How It Works", "#how"],
            ["Marketplace Rules", "#rules"],
            ["Pricing", "#pricing"],
            ["FAQ", "#faq"],
          ].map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant="secondary"
            className="hidden rounded-full border border-primary/20 bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground sm:inline-flex"
          >
            <Sparkles className="mr-1 h-3 w-3" /> 3 Free Credits
          </Badge>
          <Button
            onClick={onLaunch}
            className="rounded-full bg-primary font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] hover:opacity-95"
          >
            Launch Studio <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </nav>
    </header>
  );
}

function LogoMark() {
  return (
    <div
      className="grid h-9 w-9 place-items-center rounded-xl"
      style={{ background: "var(--gradient-primary)" }}
    >
      <div className="h-4 w-4 rounded-sm bg-white shadow-sm" />
    </div>
  );
}

function Hero({
  sliderPos,
  setSliderPos,
  amazonPreset,
  setAmazonPreset,
  softShadow,
  setSoftShadow,
  onBatchExport,
  onSingleDownload,
}: {
  sliderPos: number;
  setSliderPos: (n: number) => void;
  amazonPreset: boolean;
  setAmazonPreset: (b: boolean) => void;
  softShadow: boolean;
  setSoftShadow: (b: boolean) => void;
  onBatchExport: () => void;
  onSingleDownload: () => void;
}) {
  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "var(--gradient-hero)" }}
    >
      <div className="mx-auto max-w-7xl px-6 pb-16 pt-16 md:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <Badge className="mb-6 rounded-full border border-primary/20 bg-white px-4 py-1.5 text-xs font-semibold text-primary shadow-sm hover:bg-white">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            100% Amazon Compliant (#FFFFFF) • Auto-Resize 1000×1000px
          </Badge>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground md:text-6xl">
            Instant Pure White Backgrounds for{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "var(--gradient-primary)" }}
            >
              Amazon & E-Commerce
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Upload product photos in bulk. Remove backgrounds, apply pure #FFFFFF canvas,
            format to 1000×1000px, and add realistic shadows in 5 seconds.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-5xl">
          <Card
            className="overflow-hidden rounded-2xl border-border/70 bg-white p-0"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="border-b border-border/60 p-6 md:p-8">
              <div className="group relative rounded-xl border-2 border-dashed border-primary/30 bg-accent/40 p-8 text-center transition-colors hover:border-primary/60 hover:bg-accent/70">
                <div
                  className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl text-white"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  <Upload className="h-6 w-6" />
                </div>
                <p className="text-base font-semibold text-foreground">
                  Drop up to 50 photos — JPEG, PNG, WEBP
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Batch supported. Max 20MB per file.
                </p>
                <div className="mt-5 flex flex-col items-center gap-2">
                  <Button
                    size="lg"
                    className="rounded-full bg-primary px-6 font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] hover:opacity-95"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Product Photos (Batch Supported)
                  </Button>
                  <button className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                    or try with a sample product photo
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-6 p-6 md:grid-cols-[1.4fr_1fr] md:p-8">
              <BeforeAfter
                pos={sliderPos}
                setPos={setSliderPos}
                beforeImage={heroSneakerBefore.url}
                afterImage={heroSneakerAfter.url}
              />

              <div className="flex flex-col justify-between gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Control Panel
                    </p>
                    <h3 className="mt-1 font-display text-lg font-bold">
                      Studio Settings
                    </h3>
                  </div>

                  <ToggleRow
                    icon={<Layers className="h-4 w-4" />}
                    title="Amazon 1000×1000px Preset"
                    desc="Square 1:1 · 85% frame fill"
                    checked={amazonPreset}
                    onCheckedChange={setAmazonPreset}
                  />
                  <ToggleRow
                    icon={<Wand2 className="h-4 w-4" />}
                    title="AI Real Soft Shadow"
                    desc="Natural drop shadow injection"
                    checked={softShadow}
                    onCheckedChange={setSoftShadow}
                  />
                </div>

                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-center rounded-lg border-border/70 font-medium"
                    onClick={onSingleDownload}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Single PNG (High-Res)
                  </Button>
                  <Button
                    onClick={onBatchExport}
                    className="w-full justify-center rounded-lg bg-primary font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] hover:opacity-95"
                  >
                    <Package className="mr-2 h-4 w-4" />
                    Download All as .ZIP (Batch Export)
                  </Button>
                  <p className="text-center text-[11px] text-muted-foreground">
                    Batches over 3 photos require Pro
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

function ToggleRow({
  icon,
  title,
  desc,
  checked,
  onCheckedChange,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  checked: boolean;
  onCheckedChange: (b: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/40 p-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 grid h-8 w-8 place-items-center rounded-md bg-accent text-primary">
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function BeforeAfter({
  pos,
  setPos,
  beforeImage,
  afterImage,
}: {
  pos: number;
  setPos: (n: number) => void;
  beforeImage: string;
  afterImage: string;
}) {
  return (
    <div className="space-y-3">
      <div
        className="relative aspect-square w-full overflow-hidden rounded-xl border border-border/70 select-none"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="absolute inset-0 bg-white">
          <img
            src={afterImage}
            alt="After editing on pure white background"
            className="h-full w-full object-cover"
            loading="lazy"
            width={1024}
            height={1024}
          />
          <span className="absolute right-2 top-2 rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
            AFTER · #FFFFFF
          </span>
        </div>
        <div
          className="absolute inset-0 overflow-hidden"
          style={{
            clipPath: `polygon(0 0, ${pos}% 0, ${pos}% 100%, 0 100%)`,
          }}
        >
          <img
            src={beforeImage}
            alt="Before editing with original background"
            className="h-full w-full object-cover"
            loading="lazy"
            width={1024}
            height={1024}
          />
          <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
            BEFORE
          </span>
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.1)]"
          style={{ left: `calc(${pos}% - 1px)` }}
        >
          <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-white p-1.5 shadow-md">
            <div className="flex gap-0.5">
              <div className="h-3 w-0.5 bg-foreground/60" />
              <div className="h-3 w-0.5 bg-foreground/60" />
            </div>
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          className="absolute inset-0 z-20 h-full w-full cursor-ew-resize opacity-0"
          aria-label="Before/after slider"
        />
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Drag the divider to compare
      </p>
    </div>
  );
}


function ProductMock({ shadow = false }: { shadow?: boolean }) {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="relative">
        <div
          className="h-40 w-24 rounded-b-[2rem] rounded-t-lg bg-gradient-to-b from-primary via-primary to-[oklch(0.35_0.18_277)]"
          style={
            shadow
              ? { filter: "drop-shadow(0 18px 12px rgba(0,0,0,0.18))" }
              : undefined
          }
        />
        <div className="absolute left-1/2 top-2 h-8 w-14 -translate-x-1/2 rounded-md bg-white/90" />
        <div className="absolute -top-3 left-1/2 h-5 w-8 -translate-x-1/2 rounded-t-md bg-[oklch(0.35_0.18_277)]" />
      </div>
    </div>
  );
}

function TrustBar() {
  return (
    <section className="border-y border-border/60 bg-muted/40 py-10">
      <div className="mx-auto max-w-7xl px-6">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Formatted for all major marketplaces
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-6 text-foreground/50">
          <MarketplaceLogos />
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Zap className="mr-1 inline h-4 w-4 text-primary" />
          Over <span className="font-semibold text-foreground">250,000+</span> product
          photos processed this month
        </p>
      </div>
    </section>
  );
}

function MarketplaceLogos() {
  const common =
    "h-7 w-auto opacity-70 grayscale transition-all hover:opacity-100 hover:grayscale-0";
  return (
    <>
      {/* Amazon */}
      <svg viewBox="0 0 120 36" className={common} aria-label="Amazon">
        <text
          x="0"
          y="26"
          fontFamily="Inter, sans-serif"
          fontSize="26"
          fontWeight="700"
          fill="currentColor"
        >
          amazon
        </text>
        <path
          d="M6 30 C 30 40, 80 40, 108 30"
          stroke="currentColor"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        <path d="M104 26 l6 4 -6 4 z" fill="currentColor" />
      </svg>
      {/* Shopify */}
      <svg viewBox="0 0 130 36" className={common} aria-label="Shopify">
        <path
          d="M18 6c-2 0-4 1-5 3-1-1-3-2-4-1-2 1-3 5-4 9l-3 14 12 3 4-28z"
          fill="currentColor"
        />
        <text
          x="28"
          y="26"
          fontFamily="Inter, sans-serif"
          fontSize="22"
          fontWeight="700"
          fill="currentColor"
        >
          shopify
        </text>
      </svg>
      {/* eBay */}
      <svg viewBox="0 0 90 36" className={common} aria-label="eBay">
        <text
          x="0"
          y="28"
          fontFamily="Inter, sans-serif"
          fontSize="28"
          fontWeight="800"
          fill="currentColor"
        >
          ebay
        </text>
      </svg>
      {/* Etsy */}
      <svg viewBox="0 0 80 36" className={common} aria-label="Etsy">
        <text
          x="0"
          y="28"
          fontFamily="Georgia, serif"
          fontSize="28"
          fontStyle="italic"
          fontWeight="700"
          fill="currentColor"
        >
          Etsy
        </text>
      </svg>
      {/* Walmart */}
      <svg viewBox="0 0 140 36" className={common} aria-label="Walmart">
        <g transform="translate(4,4)" fill="currentColor">
          {[0, 45, 90, 135].map((r) => (
            <rect
              key={r}
              x="12"
              y="2"
              width="2.5"
              height="10"
              rx="1"
              transform={`rotate(${r} 13 13)`}
            />
          ))}
        </g>
        <text
          x="34"
          y="26"
          fontFamily="Inter, sans-serif"
          fontSize="22"
          fontWeight="700"
          fill="currentColor"
        >
          Walmart
        </text>
      </svg>
      {/* WooCommerce */}
      <svg viewBox="0 0 160 36" className={common} aria-label="WooCommerce">
        <rect x="0" y="8" width="30" height="20" rx="4" fill="currentColor" opacity="0.85" />
        <text
          x="4"
          y="23"
          fontFamily="Inter, sans-serif"
          fontSize="12"
          fontWeight="800"
          fill="var(--background)"
        >
          Woo
        </text>
        <text
          x="36"
          y="26"
          fontFamily="Inter, sans-serif"
          fontSize="20"
          fontWeight="700"
          fill="currentColor"
        >
          WooCommerce
        </text>
      </svg>
    </>
  );
}

function UseCases() {
  const tabs = [
    {
      id: "sellers",
      label: "Amazon & E-Commerce Sellers",
      bullets: [
        "100% Amazon algorithm compliant",
        "Instant 1000×1000px square frame fill",
        "Batch export for whole catalogs",
      ],
      beforeImage: sellersHeadphonesBefore.url,
      afterImage: sellersHeadphonesAfter.url,
    },
    {
      id: "agencies",
      label: "Agencies & Freelancers",
      bullets: [
        "Bulk processing up to 50 photos in seconds",
        "High-res PNG export",
        "Commercial usage rights included",
      ],
      beforeImage: agenciesPerfumeBefore.url,
      afterImage: agenciesPerfumeAfter.url,
    },
    {
      id: "photographers",
      label: "Product Photographers",
      bullets: [
        "Clean object isolation without halos",
        "Real soft shadow generation",
        "Ultra-fast client deliverables",
      ],
      beforeImage: photographersWatchBefore.url,
      afterImage: photographersWatchAfter.url,
    },
  ];
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Use Cases
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold md:text-4xl">
            Tailored White Background Solutions
          </h2>
        </div>
        <Tabs defaultValue="sellers" className="mt-12">
          <TabsList className="mx-auto flex h-auto w-full max-w-3xl flex-wrap justify-center gap-2 rounded-full bg-muted/60 p-1.5">
            {tabs.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="rounded-full px-4 py-2 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[var(--shadow-elegant)]"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((t) => (
            <TabsContent key={t.id} value={t.id} className="mt-10">
              <Card
                className="grid gap-8 rounded-2xl border-border/70 bg-background p-6 md:grid-cols-2 md:p-10"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <UseCaseCompare
                  beforeImage={t.beforeImage}
                  afterImage={t.afterImage}
                />
                <div className="flex flex-col justify-center">
                  <h3 className="font-display text-2xl font-bold">{t.label}</h3>
                  <ul className="mt-6 space-y-4">
                    {t.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-3">
                        <div className="mt-0.5 grid h-6 w-6 place-items-center rounded-full bg-accent text-primary">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-sm text-foreground/80">{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}


function UseCaseCompare() {
  const [pos, setPos] = useState(50);
  return (
    <div
      className="relative aspect-square w-full overflow-hidden rounded-xl border border-border/70 select-none"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="absolute inset-0 bg-white">
        <ProductMock shadow />
        <span className="absolute right-2 top-2 rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
          AFTER · #FFFFFF
        </span>
      </div>
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          clipPath: `polygon(0 0, ${pos}% 0, ${pos}% 100%, 0 100%)`,
          background:
            "linear-gradient(135deg, #6b7c8a 0%, #3d4a55 50%, #1e2530 100%)",
        }}
      >
        <ProductMock />
        <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
          BEFORE
        </span>
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.1)]"
        style={{ left: `calc(${pos}% - 1px)` }}
      >
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-white p-1.5 shadow-md">
          <div className="flex gap-0.5">
            <div className="h-3 w-0.5 bg-foreground/60" />
            <div className="h-3 w-0.5 bg-foreground/60" />
          </div>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        className="absolute inset-0 z-20 h-full w-full cursor-ew-resize opacity-0"
        aria-label="Before/after slider"
      />
    </div>
  );
}

function AmazonGuideDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
}) {
  const points = [
    {
      title: "Background Color",
      desc: "Must be Pure White RGB (255, 255, 255 / #FFFFFF).",
    },
    {
      title: "Frame Fill",
      desc: "Product must occupy at least 85% of the frame.",
    },
    {
      title: "Resolution",
      desc: "Minimum 1000×1000px for high-res zoom functionality.",
    },
    {
      title: "Clean Presentation",
      desc: "Pure product photo only (no added badges, watermarks, or text).",
    },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden rounded-2xl p-0">
        <div
          className="px-7 pb-5 pt-7 text-white"
          style={{ background: "var(--gradient-primary)" }}
        >
          <Badge className="mb-3 rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-white/20">
            <ShieldCheck className="mr-1 h-3 w-3" /> Official Guidelines
          </Badge>
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-2xl font-bold text-white">
              Amazon Main Image Compliance Checklist
            </DialogTitle>
            <DialogDescription className="text-white/80">
              Meet all four rules to avoid listing suppression.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-4 px-7 py-6">
          {points.map((p, i) => (
            <div key={p.title} className="flex items-start gap-3">
              <div className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-primary">
                {i + 1}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{p.title}</p>
                <p className="text-sm text-muted-foreground">{p.desc}</p>
              </div>
            </div>
          ))}
          <Button
            size="lg"
            onClick={() => {
              onOpenChange(false);
              if (typeof window !== "undefined") {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
            className="mt-2 w-full rounded-lg bg-primary py-6 text-base font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] hover:opacity-95"
          >
            Format Your Photos to Amazon Rules
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ValueProps() {
  const items = [
    {
      icon: <Package className="h-5 w-5" />,
      title: "Batch Processing in 20 Seconds",
      desc: "Upload up to 50 photos at once and download a single organized .ZIP file. No more editing one by one.",
    },
    {
      icon: <ShieldCheck className="h-5 w-5" />,
      title: "100% Amazon Compliance Guarantee",
      desc: "Automatically scaled to 1:1 square ratio with exact #FFFFFF pure white background, meeting Amazon's strict 85% frame coverage rule.",
    },
    {
      icon: <Wand2 className="h-5 w-5" />,
      title: "Real Soft Shadows (No Flat Stickers)",
      desc: "Injects soft realistic drop shadows so your product looks natural, expensive, and high-converting.",
    },
  ];
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Why PureWhite BG
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold md:text-4xl">
            Built for sellers, not photographers
          </h2>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {items.map((f) => (
            <Card
              key={f.title}
              className="group rounded-2xl border-border/70 p-7 transition-all hover:-translate-y-1 hover:border-primary/40"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div
                className="grid h-11 w-11 place-items-center rounded-xl text-white"
                style={{ background: "var(--gradient-primary)" }}
              >
                {f.icon}
              </div>
              <h3 className="mt-5 font-display text-lg font-bold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {f.desc}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      icon: <Upload className="h-5 w-5" />,
      title: "Upload Raw Photos",
      desc: "Drag single or batch product shots taken from any phone or camera.",
    },
    {
      n: "02",
      icon: <Sparkles className="h-5 w-5" />,
      title: "Instant Formatting",
      desc: "Auto-isolates object, injects pure #FFFFFF white, and centers the photo.",
    },
    {
      n: "03",
      icon: <Package className="h-5 w-5" />,
      title: "Bulk ZIP Export",
      desc: "Download production-ready listing photos individually or as a single ZIP.",
    },
  ];
  return (
    <section id="how" className="border-y border-border/60 bg-muted/30 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            How it works
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold md:text-4xl">
            Compliant listings in three steps
          </h2>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.n}
              className="relative rounded-2xl border border-border/70 bg-background p-7"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <span className="font-display text-5xl font-extrabold text-primary/10">
                {s.n}
              </span>
              <div className="-mt-6 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-primary">
                  {s.icon}
                </div>
                <h3 className="font-display text-lg font-bold">{s.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ComplianceTable() {
  const rows = [
    ["Amazon FBA", "Pure White (#FFFFFF)", "1:1 Square · 1000×1000px min", "Product covers 85%+"],
    ["eBay", "Pure White to Off-White", "1:1 Square · 500×500px min", "No added borders/text"],
    ["Shopify / Etsy", "Pure White / Custom", "1:1 or 4:3 Ratio", "Uniform margins & padding"],
  ];
  return (
    <section id="rules" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Marketplace Compliance
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold md:text-4xl">
            One tool. Every marketplace rule.
          </h2>
        </div>
        <div
          className="mt-12 overflow-hidden rounded-2xl border border-border/70 bg-background"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div className="grid grid-cols-2 gap-4 border-b border-border/70 bg-muted/50 px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:grid-cols-4">
            <div>Marketplace</div>
            <div className="hidden md:block">Background</div>
            <div className="hidden md:block">Aspect & Resolution</div>
            <div>Frame Fill Rule</div>
          </div>
          {rows.map((r, i) => (
            <div
              key={r[0]}
              className={`grid grid-cols-2 gap-4 px-6 py-5 text-sm md:grid-cols-4 ${
                i !== rows.length - 1 ? "border-b border-border/60" : ""
              }`}
            >
              <div className="font-semibold text-foreground">{r[0]}</div>
              <div className="text-muted-foreground">{r[1]}</div>
              <div className="text-muted-foreground">{r[2]}</div>
              <div className="text-muted-foreground">{r[3]}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing({ onUpgrade }: { onUpgrade: () => void }) {
  const tiers = [
    {
      name: "Free Trial",
      price: "$0",
      cadence: "",
      features: [
        "3 Free High-Res Photo Downloads",
        "Basic #FFFFFF Background Isolation",
        "Single File Download",
      ],
      cta: "Start Free (3 Credits)",
      featured: false,
      disabled: false,
    },
    {
      name: "Pro Seller Pass",
      price: "$9.99",
      cadence: "/month",
      features: [
        "Unlimited Background Removals",
        "50-Photo Batch Upload & ZIP Export",
        "Auto 1000×1000px Amazon Preset",
        "AI Soft Shadow Generator",
        "Priority Processing Speed",
        "Commercial License",
      ],
      cta: "Upgrade to Pro ($9.99/mo)",
      featured: true,
      disabled: false,
    },
    {
      name: "Lifetime Credit Pass",
      price: "$29",
      cadence: "one-time",
      features: [
        "500 Credits (No Subscription)",
        "All Pro Features Included",
        "ZIP Export Included",
      ],
      cta: "Buy Lifetime Pass",
      featured: false,
      disabled: false,
    },
  ];
  return (
    <section id="pricing" className="border-y border-border/60 bg-muted/30 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold md:text-4xl">
            Simple, Transparent Pricing for Sellers
          </h2>
          <p className="mt-3 text-muted-foreground">
            Start with 3 free processing credits. Upgrade as your catalog grows.
          </p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {tiers.map((t) => (
            <Card
              key={t.name}
              className={`relative flex flex-col rounded-2xl p-7 ${
                t.featured
                  ? "border-primary/40 bg-background ring-1 ring-primary/30"
                  : "border-border/70 bg-background"
              }`}
              style={{
                boxShadow: t.featured
                  ? "var(--shadow-elegant)"
                  : "var(--shadow-card)",
              }}
            >
              {t.featured && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                  Most Popular
                </Badge>
              )}
              <h3 className="font-display text-lg font-bold">{t.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-display text-4xl font-extrabold">
                  {t.price}
                </span>
                <span className="text-sm text-muted-foreground">{t.cadence}</span>
              </div>
              <ul className="mt-6 flex-1 space-y-3">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    <span className="text-foreground/80">{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={t.featured || t.name.startsWith("Lifetime") ? onUpgrade : undefined}
                disabled={t.disabled}
                variant={t.featured ? "default" : "outline"}
                className={`mt-7 w-full rounded-lg font-semibold ${
                  t.featured
                    ? "bg-primary text-primary-foreground shadow-[var(--shadow-elegant)] hover:opacity-95"
                    : ""
                }`}
              >
                {t.cta}
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function PaywallDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden rounded-2xl p-0">
        <div
          className="px-7 pb-5 pt-7 text-white"
          style={{ background: "var(--gradient-primary)" }}
        >
          <Badge className="mb-3 rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-white/20">
            Save 50% Today — Only $9.99/mo
          </Badge>
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-2xl font-bold text-white">
              Unlock Unlimited Batch Processing & ZIP Export
            </DialogTitle>
            <DialogDescription className="text-white/80">
              Upgrade to Pro and process your entire catalog in one click.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-3 px-7 py-6">
          {[
            "Download all 50 photos in 1 click (.ZIP)",
            "Soft Shadows & 1000×1000px Amazon Presets",
            "Instant processing (under 2 seconds per image)",
          ].map((b) => (
            <div key={b} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
              <span>{b}</span>
            </div>
          ))}
          <Button
            size="lg"
            className="mt-4 w-full rounded-lg bg-primary py-6 text-base font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] hover:opacity-95"
          >
            <Lock className="mr-2 h-4 w-4" />
            Get Pro Access Now
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Secure checkout · Cancel anytime
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FAQ() {
  const items = [
    {
      q: "Why does Amazon suppress listings without pure white backgrounds?",
      a: "Amazon's ranking algorithm enforces pure RGB 255,255,255 (#FFFFFF) main images to maintain a consistent grid experience across desktop and mobile. Non-compliant images can be suppressed from search or removed entirely, tanking your organic visibility and BSR.",
    },
    {
      q: "How does the 50-photo batch upload work?",
      a: "Photos are processed in parallel using our GPU inference pipeline. Once complete, a ZIP archive is generated client-side and streamed to your browser — no waiting, no server round-trips for downloads.",
    },
    {
      q: "Will my images lose quality during resizing?",
      a: "No. Output canvases are padded and upscaled with a high-fidelity resampler up to 2000×2000px crisp resolution. Your product edges remain sharp and print-ready.",
    },
    {
      q: "Is my product photography kept private?",
      a: "Yes. All uploaded assets are encrypted in transit and at rest, isolated to your session, and auto-deleted within 24 hours of processing. We never train models on your data.",
    },
  ];
  return (
    <section id="faq" className="py-24">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            FAQ
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold md:text-4xl">
            Answers for serious sellers
          </h2>
        </div>
        <Accordion type="single" collapsible className="mt-10 space-y-3">
          {items.map((item, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="rounded-xl border border-border/70 bg-background px-5"
            >
              <AccordionTrigger className="text-left font-display text-base font-semibold hover:no-underline">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

function Footer({ onOpenAmazonGuide }: { onOpenAmazonGuide: () => void }) {
  const [lang, setLang] = useState("English");
  return (
    <footer className="border-t border-border/60 bg-muted/30 py-14">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <LogoMark />
              <span className="font-display text-lg font-bold tracking-tight">
                PureWhite <span className="text-primary">BG</span>
              </span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              The #1 Pure White Background Studio for E-Commerce Sellers.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">purewhitebg.com</p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            {["Terms of Service", "Privacy Policy", "Support Contact"].map((l) => (
              <a
                key={l}
                href="#"
                className="font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {l}
              </a>
            ))}
            <button
              onClick={onOpenAmazonGuide}
              className="font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Amazon Image Guidelines Guide
            </button>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-6 text-xs text-muted-foreground md:flex-row">
          <p>© 2026 PureWhite BG. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-5">
            <span className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <span className="font-medium text-foreground/80">
                All Systems Operational
              </span>
            </span>
            <span className="flex items-center gap-1">
              <ImageIcon className="h-3 w-3" /> Trusted by 250,000+ sellers this month
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full border-border/70 px-3 text-xs font-medium"
                >
                  <Globe className="mr-1.5 h-3.5 w-3.5" />
                  {lang}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[10rem]">
                {["English", "Español", "Deutsch", "Français", "日本語"].map((l) => (
                  <DropdownMenuItem key={l} onClick={() => setLang(l)}>
                    {l}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </footer>
  );
}
