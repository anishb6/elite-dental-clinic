/**
 * Server-only environment configuration (secrets).
 *
 * The `.server.ts` suffix keeps this module out of the browser bundle. Import it
 * only from server handlers - inside route files use a dynamic `import()` within
 * the handler so the module is never reachable from client code.
 *
 * Values are read lazily and validated on first use so that a missing secret
 * produces a clear, logged `ConfigError` instead of crashing the whole server
 * at boot.
 */
import { z } from "zod";
import { AppError } from "@/lib/errors";

const DEFAULT_NOTIFY_FROM = "Website Bookings <onboarding@resend.dev>";

const serverDatabaseEnvSchema = z.object({
  SUPABASE_URL: z
    .string({ required_error: "SUPABASE_URL is required" })
    .url("SUPABASE_URL must be a valid URL"),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string({ required_error: "SUPABASE_SERVICE_ROLE_KEY is required" })
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
});

const notifyEnvSchema = z.object({
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
  NOTIFY_EMAIL: z.string().min(1, "NOTIFY_EMAIL is required"),
  NOTIFY_FROM: z.string().min(1).default(DEFAULT_NOTIFY_FROM),
});

export type ServerDatabaseEnv = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
};

export type NotifyEnv = {
  resendApiKey: string;
  /** One or more recipient addresses (NOTIFY_EMAIL may be comma separated). */
  recipients: string[];
  from: string;
};

/** Validate trusted server-side Supabase database credentials. */
export function getServerDatabaseEnv(): ServerDatabaseEnv {
  const parsed = serverDatabaseEnvSchema.safeParse({
    SUPABASE_URL: process.env["SUPABASE_URL"],
    SUPABASE_SERVICE_ROLE_KEY: process.env["SUPABASE_SERVICE_ROLE_KEY"],
  });

  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => i.message).join("; ");
    throw new AppError("CONFIG", `Server database configuration error: ${problems}`, {
      status: 500,
      userMessage: "Server database configuration is incomplete. Please check server settings.",
    });
  }

  return {
    supabaseUrl: parsed.data.SUPABASE_URL,
    supabaseServiceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY,
  };
}

/** Returns a trimmed-non-empty env value as-is, or `undefined` when unset or blank. */
function readOptional(name: string): string | undefined {
  const value = process.env[name];
  return value !== undefined && value.trim() !== "" ? value : undefined;
}

/** True when `SUPABASE_SERVICE_ROLE_KEY` is set, i.e. the trusted server database is usable. */
export function hasServiceRoleKey(): boolean {
  return readOptional("SUPABASE_SERVICE_ROLE_KEY") !== undefined;
}

/** Shared secret for internal endpoints (`X-Notify-Secret`), or `undefined` when not configured. */
export function getNotifySecret(): string | undefined {
  return readOptional("NOTIFY_SECRET");
}

/** Cloudflare Turnstile secret, or `undefined` when not configured. */
export function getTurnstileSecret(): string | undefined {
  return readOptional("TURNSTILE_SECRET_KEY");
}

/** True only for an explicit local development or test run; never in production. */
export function isExplicitDevOrTest(): boolean {
  const nodeEnv = process.env["NODE_ENV"];
  if (nodeEnv === "production") return false;
  return nodeEnv === "test" || nodeEnv === "development" || Boolean(process.env["VITEST"]);
}

/** Check if Resend email notifications are fully configured. */
export function isEmailConfigured(): boolean {
  const apiKey = process.env["RESEND_API_KEY"];
  const email = process.env["NOTIFY_EMAIL"];
  return Boolean(apiKey && apiKey.trim() !== "" && email && email.trim() !== "");
}

export function getNotifyEnv(): NotifyEnv {
  const parsed = notifyEnvSchema.safeParse({
    RESEND_API_KEY: process.env["RESEND_API_KEY"],
    NOTIFY_EMAIL: process.env["NOTIFY_EMAIL"],
    NOTIFY_FROM: process.env["NOTIFY_FROM"] || undefined,
  });

  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => i.message).join("; ");
    throw new AppError("CONFIG", `Invalid server environment: ${problems}`, {
      status: 500,
      userMessage: "The notification service is not configured.",
    });
  }

  const { RESEND_API_KEY, NOTIFY_EMAIL, NOTIFY_FROM } = parsed.data;
  return {
    resendApiKey: RESEND_API_KEY,
    recipients: NOTIFY_EMAIL.split(",")
      .map((address) => address.trim())
      .filter(Boolean),
    from: NOTIFY_FROM,
  };
}

/**
 * Returns the allowlist of email addresses authorized to access staff admin endpoints.
 *
 * Configured ONLY via `STAFF_EMAILS` (comma-separated). There is deliberately no fallback to
 * the notification recipients or any built-in address: admin access must be an explicit,
 * auditable decision. When `STAFF_EMAILS` is unset or empty the list is empty (fail closed);
 * staff can still be authorized through a server-controlled `app_metadata.role`.
 */
export function getStaffAllowlist(): string[] {
  const raw = process.env["STAFF_EMAILS"];
  if (!raw || raw.trim() === "") return [];

  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}
