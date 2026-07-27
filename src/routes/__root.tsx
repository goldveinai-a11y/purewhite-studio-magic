import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PureWhite BG — #1 Amazon Background Remover & Batch Editor" },
      { name: "description", content: "Batch remove backgrounds to 100% pure white (#FFFFFF) for Amazon, Shopify & eBay. Auto-resize to 1000x1000px, add soft shadows & export ZIP in 5 seconds." },
      { name: "keywords", content: "amazon background remover, pure white background app, batch photo background isolation, 1000x1000 amazon image resizer, ebay white background generator" },
      { name: "author", content: "PureWhite BG" },
      { property: "og:title", content: "PureWhite BG — #1 Amazon Background Remover & Batch Editor" },
      { property: "og:description", content: "Batch remove backgrounds to 100% pure white (#FFFFFF) for Amazon, Shopify & eBay. Auto-resize to 1000x1000px, add soft shadows & export ZIP in 5 seconds." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://purewhitebg.com" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@PureWhiteBG" },
      { name: "twitter:title", content: "PureWhite BG — #1 Amazon Background Remover & Batch Editor" },
      { name: "twitter:description", content: "Batch remove backgrounds to 100% pure white (#FFFFFF) for Amazon, Shopify & eBay. Auto-resize to 1000x1000px, add soft shadows & export ZIP in 5 seconds." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/KW94mdhnmkcPtnp7O6xEh88CJjt1/social-images/social-1784886136698-Screenshot_2026-07-24_at_11.41.30.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/KW94mdhnmkcPtnp7O6xEh88CJjt1/social-images/social-1784886136698-Screenshot_2026-07-24_at_11.41.30.webp" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // Client-visible only (Measurement IDs are public identifiers, not
  // secrets - same convention as VITE_PAYMENTS_CLIENT_TOKEN below). Absent
  // until the GA4 property is created; the whole snippet is skipped rather
  // than shipping a broken gtag call.
  const gaId = import.meta.env.VITE_GA4_MEASUREMENT_ID as string | undefined;
  return (
    <html lang="en-US">
      <head>
        <HeadContent />
        {gaId ? (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
            <script
              // send_page_view stays on the default (true): TanStack Router
              // does full <a> navigations for most routes in this app, so
              // gtag's own history listener already covers page_view
              // correctly without extra wiring.
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`,
              }}
            />
          </>
        ) : null}
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
