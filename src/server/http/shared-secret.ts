/**
 * Guard for internal endpoints (cron triggers, background workers) that authenticate with the
 * `X-Notify-Secret` header instead of a staff session.
 */
import { getNotifySecret } from "@/config/env.server";
import { AppError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";

const logger = createLogger("shared-secret");

/** Constant-time string comparison (avoids timing side-channels). */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Throws unless the request carries the configured `X-Notify-Secret`.
 *
 * - `NOTIFY_SECRET` unset/blank -> 500 `CONFIG`: authentication is never skipped.
 * - Missing or wrong header     -> 401.
 */
export function requireNotifySecret(request: Request): void {
  const expected = getNotifySecret();
  if (!expected) {
    logger.error("NOTIFY_SECRET is not configured on the server");
    throw new AppError("CONFIG", "Notification service secret is not configured on the server", {
      status: 500,
      userMessage: "Notification service is unavailable.",
    });
  }

  const supplied = request.headers.get("x-notify-secret") ?? "";
  if (!constantTimeEqual(supplied, expected)) {
    throw new AppError("VALIDATION", "Invalid or missing X-Notify-Secret header", {
      status: 401,
      userMessage: "Unauthorized.",
    });
  }
}
