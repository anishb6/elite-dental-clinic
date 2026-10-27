/**
 * Lightweight Google Analytics 4 helpers.
 *
 * Everything is a no-op when GA isn't configured (no `VITE_GA_ID`) or the
 * visitor blocks it, so tracking can never break the site.
 */

type Gtag = (...args: unknown[]) => void;

/** Typed catalogue of events, so names can't drift between call sites. */
export type AnalyticsEvent =
  | "call_click"
  | "whatsapp_click"
  | "directions_click"
  | "book_click"
  | "booking_submitted"
  | "booking_failed";

export function track(event: AnalyticsEvent, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  try {
    const gtag = (window as unknown as { gtag?: Gtag }).gtag;
    gtag?.("event", event, params);
  } catch {
    /* never let analytics break the page */
  }
}

/** `<head>` script tags that load GA, or an empty list when GA is not configured. */
export function buildAnalyticsScripts(gaId: string | undefined) {
  if (!gaId) return [];
  return [
    { src: `https://www.googletagmanager.com/gtag/js?id=${gaId}`, async: true },
    {
      children: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","${gaId}");`,
    },
  ];
}

/** Maps an anchor `href` to the booking-funnel event it represents (if any). */
export function classifyLink(href: string): AnalyticsEvent | null {
  if (href.startsWith("tel:")) return "call_click";
  if (href.includes("wa.me")) return "whatsapp_click";
  if (href.includes("maps.app.goo.gl") || href.includes("google.com/maps"))
    return "directions_click";
  if (href === "/book" || href.startsWith("/book?")) return "book_click";
  return null;
}

/** One delegated click listener tracks the clicks that matter for the booking funnel. */
export function initClickTracking(): () => void {
  const onClick = (event: MouseEvent) => {
    const anchor = (event.target as HTMLElement | null)?.closest?.("a");
    if (!anchor) return;
    const analyticsEvent = classifyLink(anchor.getAttribute("href") ?? "");
    if (!analyticsEvent) return;
    track(analyticsEvent, {
      page: window.location.pathname,
      label: (anchor.textContent ?? "").trim().slice(0, 40),
    });
  };
  document.addEventListener("click", onClick);
  return () => document.removeEventListener("click", onClick);
}
