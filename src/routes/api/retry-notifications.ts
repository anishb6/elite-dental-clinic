import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/retry-notifications
 *
 * Manual / external trigger to drain pending or failed notification jobs from
 * `public.notification_outbox`. The built-in schedule (see `src/server/tasks/retry-notifications.ts`)
 * already does this every 5 minutes; this endpoint remains for on-demand runs and external schedulers.
 *
 * Security: Requires `X-Notify-Secret: <NOTIFY_SECRET>`.
 */
export const Route = createFileRoute("/api/retry-notifications")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const [{ withApiHandler }, { jsonOk }, { requireNotifySecret }] = await Promise.all([
          import("@/server/http/with-api-handler"),
          import("@/server/http/responses"),
          import("@/server/http/shared-secret"),
        ]);

        return withApiHandler("retry-notifications", async (req) => {
          requireNotifySecret(req);
          const { retryPendingNotifications } =
            await import("@/features/appointments/server/retry-notifications.server");
          return jsonOk(await retryPendingNotifications());
        })(request);
      },
    },
  },
});
