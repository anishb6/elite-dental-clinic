import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { NotFound } from "@/components/feedback/not-found";
import { RouteError } from "@/components/feedback/route-error";
import { publicEnv } from "@/config/env.public";
import { CLINIC } from "@/config/site";
import { HERO_PHOTO } from "@/features/clinic/data/photos";
import { buildAnalyticsScripts, initClickTracking } from "@/lib/analytics";
import { absoluteUrl, buildClinicStructuredData } from "@/lib/seo";
import appCss from "../styles.css?url";

const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Manrope:wght@400;500;600;700&display=swap";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Elite Dental Clinic Barasat — Dr. Debayan Saha" },
      {
        name: "description",
        content: "Modern, gentle dental care in Barasat by Dr. Debayan Saha.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: CLINIC.name },
      { property: "og:locale", content: "en_IN" },
      { property: "og:image", content: absoluteUrl(HERO_PHOTO.src) },
      { property: "og:image:alt", content: HERO_PHOTO.alt },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: absoluteUrl(HERO_PHOTO.src) },
      { name: "twitter:image:alt", content: HERO_PHOTO.alt },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: FONTS_URL },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
    scripts: [
      ...buildAnalyticsScripts(publicEnv.gaId),
      {
        type: "application/ld+json",
        children: JSON.stringify(buildClinicStructuredData()),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: RouteError,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
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
  useEffect(() => initClickTracking(), []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
