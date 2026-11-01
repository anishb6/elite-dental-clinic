/**
 * Nitro scheduled task: re-send clinic notification emails that failed or were left unsent.
 *
 * Scheduled in `vite.config.ts` (every 5 minutes); on Cloudflare, Nitro writes the cron into the
 * generated Wrangler config. It runs inside the same Worker as the site, so it needs no HTTP call
 * and no `X-Notify-Secret`. The same work is available to external callers at
 * `POST /api/retry-notifications`.
 */
import { defineTask } from "nitro/task";
import { createLogger } from "@/lib/logger";
import { retryPendingNotifications } from "../../features/appointments/server/retry-notifications.server";

const logger = createLogger("retry-notifications-task");

export default defineTask({
  meta: {
    name: "notifications:retry",
    description: "Retry clinic email notifications that failed or were left unsent",
  },
  async run() {
    try {
      const result = await retryPendingNotifications();
      if (result.processed > 0) logger.info("Outbox retry finished", result);
      return { result };
    } catch (cause) {
      // Re-thrown so Cloudflare records the run as failed and it shows up in the dashboard.
      logger.error("Scheduled outbox retry failed", {
        reason: cause instanceof Error ? cause.message : String(cause),
      });
      throw cause;
    }
  },
});
