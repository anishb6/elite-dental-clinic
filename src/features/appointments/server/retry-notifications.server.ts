/**
 * Drains the notification outbox: re-sends clinic emails whose first attempt failed (or whose worker
 * died mid-send). Shared by the scheduled task (`src/server/tasks/retry-notifications.ts`) and the
 * secret-protected `POST /api/retry-notifications` endpoint, so both behave identically.
 *
 * Safe to run concurrently or overlapping: jobs are claimed with `FOR UPDATE SKIP LOCKED`.
 */
import { getAdminClient } from "@/server/services/database.server";
import { processNotificationOutbox } from "./notification-outbox.server";

const BATCH_SIZE = 25;

export async function retryPendingNotifications() {
  const supabase = await getAdminClient("Service unavailable.");
  return processNotificationOutbox(supabase, BATCH_SIZE);
}
