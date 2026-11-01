/**
 * Single access point for the trusted (service-role) Supabase client in server handlers.
 *
 * The client module is imported lazily so the service-role key can never be pulled into a
 * browser bundle by a static import chain.
 */
import { hasServiceRoleKey } from "@/config/env.server";
import { AppError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";

const logger = createLogger("database");

/**
 * Returns the service-role client, or throws a `CONFIG` error whose `userMessage` is the supplied
 * visitor-safe text when the server isn't configured for database access.
 */
export async function getAdminClient(userMessage: string) {
  if (!hasServiceRoleKey()) {
    logger.error("SUPABASE_SERVICE_ROLE_KEY is not configured on the server");
    throw new AppError(
      "CONFIG",
      "Server database configuration is missing: SUPABASE_SERVICE_ROLE_KEY is not set",
      { status: 500, userMessage },
    );
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * Best-effort variant for optional features (e.g. the shared rate limiter): returns `null` when the
 * database isn't configured or can't be loaded, and logs why instead of failing the request.
 */
export async function tryGetAdminClient() {
  if (!hasServiceRoleKey()) return null;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return supabaseAdmin;
  } catch (cause) {
    logger.warn("Service-role client unavailable; continuing without it", {
      reason: cause instanceof Error ? cause.message : String(cause),
    });
    return null;
  }
}
