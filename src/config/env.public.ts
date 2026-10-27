/**
 * Public (non-secret) environment configuration.
 *
 * Only `VITE_*` variables may be read here: Vite inlines them into the bundle at
 * build time, so they are visible in the browser. Never put secrets in a
 * `VITE_*` variable.
 *
 * NOTE: this file must NOT be named `*.client.ts`. TanStack Start's import
 * protection treats that suffix as browser-only and refuses to bundle it for
 * SSR, but this module is also read during SSR (page `<head>`, sitemap, robots).
 *
 * Server-only secrets live in `./env.server.ts`.
 */
import { z } from "zod";
import { DEFAULT_SITE_URL } from "./site";

const gaIdSchema = z
  .string()
  .trim()
  .regex(/^G-[A-Z0-9]+$/i, "VITE_GA_ID must look like G-XXXXXXXXXX");

const siteUrlSchema = z
  .string()
  .trim()
  .url("VITE_SITE_URL must be an absolute URL such as https://example.com")
  .refine(
    (value) => /^https?:\/\//i.test(value),
    "VITE_SITE_URL must start with http:// or https://",
  );

function warnAndIgnore(name: string, error: z.ZodError) {
  // A bad optional value must never take the site down: warn and fall back.
  console.warn(
    `[env] Ignoring invalid ${name}:`,
    error.issues.map((issue) => issue.message).join("; "),
  );
}

function readGaId(): string | undefined {
  const raw = import.meta.env["VITE_GA_ID"] as string | undefined;
  if (!raw) return undefined;

  const parsed = gaIdSchema.safeParse(raw);
  if (!parsed.success) {
    warnAndIgnore("VITE_GA_ID", parsed.error);
    return undefined;
  }
  return parsed.data;
}

/**
 * Canonical production origin (scheme + host, no path, no trailing slash).
 * Used for canonical URLs, Open Graph URLs/images, the sitemap and robots.txt.
 */
function readSiteUrl(): string {
  const raw = import.meta.env["VITE_SITE_URL"] as string | undefined;
  if (!raw) return new URL(DEFAULT_SITE_URL).origin;

  const parsed = siteUrlSchema.safeParse(raw);
  if (!parsed.success) {
    warnAndIgnore("VITE_SITE_URL", parsed.error);
    return new URL(DEFAULT_SITE_URL).origin;
  }
  return new URL(parsed.data).origin;
}

function readTurnstileSiteKey(): string | undefined {
  // One canonical name only (VITE_CLOUDFLARE_TURNSTILE_SITE_KEY); the server secret is
  // TURNSTILE_SECRET_KEY. Do not add aliases - two names for one setting drift apart.
  const raw = import.meta.env["VITE_CLOUDFLARE_TURNSTILE_SITE_KEY"] as string | undefined;
  if (!raw || raw.trim() === "") return undefined;
  return raw.trim();
}

export const publicEnv = Object.freeze({
  /** Google Analytics 4 measurement id (optional - analytics is a no-op without it). */
  gaId: readGaId(),
  /** Canonical production origin, e.g. `https://drdebayansaha.in`. */
  siteUrl: readSiteUrl(),
  /** Cloudflare Turnstile public site key (optional - disabled if omitted). */
  turnstileSiteKey: readTurnstileSiteKey(),
});
