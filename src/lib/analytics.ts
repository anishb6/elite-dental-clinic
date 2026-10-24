// Lightweight Google Analytics 4 helpers. Everything is a no-op if GA isn't configured
// (no VITE_GA_ID) or the visitor blocks it, so tracking can never break the site.

type Gtag = (...args: unknown[]) => void;

export function track(event: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  try {
    gtag?.("event", event, params);
  } catch {
    /* never let analytics break the page */
  }
}

// One delegated click listener tracks the clicks that matter for the booking funnel.
export function initClickTracking(): () => void {
  const onClick = (e: MouseEvent) => {
    const a = (e.target as HTMLElement | null)?.closest?.("a");
    if (!a) return;
    const href = a.getAttribute("href") ?? "";
    const label = (a.textContent ?? "").trim().slice(0, 40);
    const page = window.location.pathname;
    if (href.startsWith("tel:")) track("call_click", { page, label });
    else if (href.includes("wa.me")) track("whatsapp_click", { page, label });
    else if (href.includes("maps.app.goo.gl") || href.includes("google.com/maps"))
      track("directions_click", { page, label });
    else if (href === "/book" || href.startsWith("/book?")) track("book_click", { page, label });
  };
  document.addEventListener("click", onClick);
  return () => document.removeEventListener("click", onClick);
}
