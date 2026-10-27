import { createFileRoute } from "@tanstack/react-router";
import { AppError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";

const logger = createLogger("retry-notifications");

/** Constant-time string comparison (avoids timing side-channels). */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * POST /api/retry-notifications
 *
 * Internal endpoint for scheduled cron triggers or background workers to drain
 * pending/failed notification jobs from `public.notification_outbox`.
 *
 * Security: Requires `X-Notify-Secret: <NOTIFY_SECRET>`.
 */
export const Route = createFileRoute("/api/retry-notifications")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const [{ withApiHandler }, { jsonOk }] = await Promise.all([
          import("@/server/http/with-api-handler"),
          import("@/server/http/responses"),
        ]);

        return withApiHandler("retry-notifications", async (req) => {
          const expectedSecret = process.env["NOTIFY_SECRET"];
          if (!expectedSecret || expectedSecret.trim() === "") {
            logger.error("NOTIFY_SECRET is not configured on the server");
            throw new AppError(
              "CONFIG",
              "Notification service secret is not configured on the server",
              {
                status: 500,
                userMessage: "Service unavailable.",
              },
            );
          }

          const suppliedSecret = req.headers.get("x-notify-secret") ?? "";
          if (!constantTimeEqual(suppliedSecret, expectedSecret)) {
            throw new AppError("VALIDATION", "Invalid or missing X-Notify-Secret header", {
              status: 401,
              userMessage: "Unauthorized.",
            });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { processNotificationOutbox } =
            await import("@/features/appointments/server/notification-outbox.server");

          const result = await processNotificationOutbox(supabaseAdmin, 25);
          return jsonOk(result);
        })(request);
      },
    },
  },
});
