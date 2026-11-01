/**
 * In-memory fixed-window rate limiter: the first request starts a window, and requests in
 * that window are counted until it expires (a burst can straddle two windows).
 *
 * ⚠️  SINGLE-INSTANCE ONLY.  This counter lives in process memory.
 * In a multi-instance or serverless deployment each instance has its own
 * counter, so the effective limit is `max * number-of-instances`.
 * For a shared/distributed limit, replace this with a Supabase table counter
 * or an external KV store (e.g. Cloudflare KV / Upstash Redis).
 *
 * The IP address is extracted from Cloudflare's `CF-Connecting-IP` header when
 * present, then `X-Real-IP`, then `X-Forwarded-For`, then falls back to a constant
 * sentinel so the limiter still applies on localhost.  Values must look like an IP
 * address; from `X-Forwarded-For` the LAST valid entry is used (the one appended by the
 * nearest proxy), because earlier entries can be written by the client.  These headers
 * are only trustworthy if the origin is reachable solely through a trusted proxy.
 *
 * The counter is keyed on `<endpoint>:<ip>` to keep limits per-endpoint.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { AppError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";

const logger = createLogger("rate-limit");

type Window = { count: number; resetAt: number };

// Module-level store (process lifetime).
const store = new Map<string, Window>();

/** Prune expired windows to prevent unbounded memory growth. */
function prune(now: number): void {
  for (const [key, window] of store) {
    if (now > window.resetAt) store.delete(key);
  }
}

export type RateLimitOptions = {
  /** Fixed window duration in milliseconds, counted from the first request. */
  windowMs: number;
  /** Maximum requests allowed per window per key. */
  max: number;
  /** Logical endpoint label used in the store key. */
  key: string;
};

/**
 * Throw a 429 `AppError` when the caller has exceeded the limit.
 * Silently succeeds (does not throw) when the limit has not been reached.
 */
export function rateLimit(request: Request, options: RateLimitOptions): void {
  const { windowMs, max, key } = options;
  const ip = getClientIp(request);
  const storeKey = `${key}:${ip}`;
  const now = Date.now();

  if (store.size > 10_000) prune(now); // safety valve

  const existing = store.get(storeKey);
  if (!existing || now > existing.resetAt) {
    store.set(storeKey, { count: 1, resetAt: now + windowMs });
    return;
  }

  existing.count += 1;
  if (existing.count > max) {
    throw new AppError("RATE_LIMIT", `Rate limit exceeded for ${key} from ${ip}`, {
      status: 429,
      userMessage: "Too many requests. Please wait a moment and try again.",
    });
  }
}

/**
 * Shared multi-instance rate limiter.
 *
 * When Supabase database access is provided, synchronizes fixed-window request counts
 * centrally across all application instances using the `public.check_rate_limit` RPC.
 * Falls back to process in-memory limiting during local tests or transient database outages.
 */
export async function rateLimitShared(
  supabase: SupabaseClient<Database> | null,
  request: Request,
  options: RateLimitOptions,
): Promise<void> {
  const { windowMs, max, key } = options;
  const ip = getClientIp(request);
  const storeKey = `${key}:${ip}`;

  let fallbackReason = "no-database-client";

  if (supabase && typeof supabase.rpc === "function") {
    try {
      const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
      const { data: allowed, error } = await supabase.rpc("check_rate_limit", {
        p_key: storeKey,
        p_max: max,
        p_window_seconds: windowSeconds,
      });

      if (!error && allowed === false) {
        throw new AppError("RATE_LIMIT", `Shared rate limit exceeded for ${key} from ${ip}`, {
          status: 429,
          userMessage: "Too many requests. Please wait a moment and try again.",
        });
      }
      if (!error && allowed === true) {
        return;
      }
      fallbackReason = error ? `rpc-error:${error.code ?? "UNKNOWN"}` : "unexpected-rpc-result";
    } catch (err) {
      if (err instanceof AppError && err.code === "RATE_LIMIT") {
        throw err;
      }
      fallbackReason = "rpc-exception";
    }
  }

  // The shared limiter was not usable (e.g. migration 0004/0005 not applied, DB outage). Degrade to
  // the per-instance limiter, but never silently: the effective limit is now per instance.
  logger.warn("Shared rate limiter unavailable; using per-instance in-memory fallback", {
    reason: fallbackReason,
    key,
  });
  rateLimit(request, options);
}

const IPV4_REGEX = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6_REGEX = /^[a-fA-F0-9:]+$/;

function isValidIp(ip: string): boolean {
  return IPV4_REGEX.test(ip) || IPV6_REGEX.test(ip);
}

/**
 * Extract the caller's IP address from trusted deployment headers.
 *
 * Priority:
 * 1. `cf-connecting-ip`: Set and overwritten by Cloudflare's edge network; cannot be spoofed.
 * 2. `x-real-ip`: Set by trusted upstream reverse proxies (e.g., Nginx proxy_set_header).
 * 3. `x-forwarded-for`: When behind reverse proxies that append client IPs, takes the LAST
 *    entry that is a valid IPv4/IPv6 address (the one the nearest proxy appended).
 * 4. Fallback to "local" for development environments.
 */
export function getClientIp(request: Request): string {
  // 1. Cloudflare edge: verified platform header
  const cf = request.headers.get("cf-connecting-ip");
  if (cf && isValidIp(cf.trim())) {
    return cf.trim();
  }

  // 2. Standard single reverse proxy (Nginx, Traefik, Caddy)
  const realIp = request.headers.get("x-real-ip");
  if (realIp && isValidIp(realIp.trim())) {
    return realIp.trim();
  }

  // 3. Multi-hop reverse proxy: inspect X-Forwarded-For
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff
      .split(",")
      .map((part) => part.trim())
      .filter((part) => isValidIp(part));

    if (parts.length > 0) {
      // Behind Cloudflare/standard edge proxy, the rightmost entry is appended by the nearest proxy
      return parts[parts.length - 1]!;
    }
  }

  return "local";
}
