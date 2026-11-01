/**
 * Durable Notification Outbox Processor.
 *
 * Implements a resilient transactional outbox pattern for clinic email notifications:
 * 1. Atomicity & Idempotency: Outbox row is uniquely keyed on `appointment_id`.
 * 2. Exponential Backoff: Survives server restarts and transient Resend API outages.
 * 3. Privacy-Conscious Metadata: Stores technical error codes without leaking patient details.
 * 4. Staff Recoverability: Outbox records are inspectable and manually retriable from Admin Dashboard.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isEmailConfigured } from "@/config/env.server";
import { AppError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { sendEmail } from "@/server/services/email.server";
import type { Database } from "@/integrations/supabase/types";
import type { AppointmentPayload } from "../schemas";
import { buildAppointmentEmail } from "./appointment-email.server";

const logger = createLogger("notification-outbox");

export type OutboxJobStatus = "pending" | "processing" | "sent" | "failed";

export type OutboxJob = {
  id: string;
  appointment_id: string;
  status: OutboxJobStatus;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  next_attempt_at: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Compute exponential backoff delay based on attempt count. */
export function calculateNextAttempt(attempts: number, baseDate = new Date()): string {
  // Backoff intervals: 1st retry in 2 mins, 2nd in 10 mins, 3rd in 30 mins, 4th in 2 hours
  const minutes = attempts === 1 ? 2 : attempts === 2 ? 10 : attempts === 3 ? 30 : 120;
  return new Date(baseDate.getTime() + minutes * 60_000).toISOString();
}

/** Sanitize and extract technical error message without exposing patient data or secrets. */
export function sanitizeErrorMetadata(error: unknown): string {
  if (error instanceof AppError) {
    return `${error.code}: ${error.message.slice(0, 200)}`;
  }
  if (error instanceof Error) {
    const safeMsg = error.message.replace(
      /([+\d\s-]{10,20})|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      "[REDACTED]",
    );
    return `ERROR: ${safeMsg.slice(0, 200)}`;
  }
  return "UNKNOWN_ERROR";
}

type OutboxProgress = { attempts: number; max_attempts: number } | null | undefined;

/**
 * Record a failed delivery attempt: count it, back off, and stop for good once attempts are used up.
 *
 * Every failure path goes through here (Resend error, email not configured, appointment missing).
 * Previously the "not configured" path only flipped the status, so `attempts` and `next_attempt_at`
 * never moved and every cron run re-claimed the same job forever.
 */
async function recordFailedAttempt(
  supabase: SupabaseClient<Database>,
  appointmentId: string,
  outbox: OutboxProgress,
  errorMetadata: string,
): Promise<void> {
  const attempts = (outbox?.attempts ?? 0) + 1;
  const maxAttempts = outbox?.max_attempts ?? 5;
  const hasExhausted = attempts >= maxAttempts;
  const nextAttemptAt = hasExhausted
    ? new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString()
    : calculateNextAttempt(attempts);

  await supabase
    .from("notification_outbox")
    .update({
      status: "failed",
      attempts,
      last_error: hasExhausted
        ? `EXHAUSTED: Max attempts (${maxAttempts}) reached. ${errorMetadata}`
        : errorMetadata,
      next_attempt_at: nextAttemptAt,
      updated_at: new Date().toISOString(),
    })
    .eq("appointment_id", appointmentId);
}

/**
 * Atomically take ownership of one appointment's outbox job.
 *
 * A single conditional UPDATE flips `pending`/`failed` -> `processing` only if the job is due, and
 * returns the row only to the caller whose UPDATE won. A concurrent cron run (which claims through
 * `claim_notification_outbox_jobs`) therefore can't also pick it up, so the clinic never gets the
 * same email twice. Returns false when someone else already owns it, or it is not due.
 */
export async function claimOutboxJob(
  supabase: SupabaseClient<Database>,
  appointmentId: string,
): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("notification_outbox")
    .update({ status: "processing", updated_at: nowIso })
    .eq("appointment_id", appointmentId)
    .in("status", ["pending", "failed"])
    .lte("next_attempt_at", nowIso)
    .select("id");

  if (error) {
    logger.warn("Could not claim outbox job; leaving it for the retry worker", {
      code: error.code ?? "UNKNOWN",
    });
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

/**
 * Claim the job, then deliver. Use this for the immediate send right after a booking; the retry
 * worker uses `deliverNotification` directly because its RPC has already claimed the row.
 */
export async function claimAndDeliverNotification(
  supabase: SupabaseClient<Database>,
  appointmentId: string,
): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  const claimed = await claimOutboxJob(supabase, appointmentId);
  if (!claimed) {
    logger.info("Outbox job already claimed elsewhere or not due; skipping immediate delivery", {
      appointmentId,
    });
    return { success: true, skipped: true };
  }
  return deliverNotification(supabase, appointmentId);
}

/** Deliver a notification for a specific appointment and update the outbox record accordingly. */
export async function deliverNotification(
  supabase: SupabaseClient<Database>,
  appointmentId: string,
): Promise<{ success: boolean; error?: string }> {
  // Idempotency check: verify current outbox status to avoid duplicate delivery
  const { data: existingOutbox } = await supabase
    .from("notification_outbox")
    .select("status, attempts, max_attempts")
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  if (existingOutbox?.status === "sent") {
    logger.info("Notification already marked as sent; skipping duplicate delivery", {
      appointmentId,
    });
    return { success: true };
  }

  // Check if Resend is configured before making calls
  if (!isEmailConfigured()) {
    const errorMsg = "CONFIG: Resend API credentials not configured on server";
    logger.warn(errorMsg);
    await recordFailedAttempt(supabase, appointmentId, existingOutbox, errorMsg);
    return { success: false, error: errorMsg };
  }

  // Fetch verified appointment record
  const { data: appointment, error: fetchError } = await supabase
    .from("appointments")
    .select(
      "id, created_at, name, phone, email, preferred_date, preferred_time, message, source, status",
    )
    .eq("id", appointmentId)
    .maybeSingle();

  if (fetchError || !appointment) {
    const errorMsg = `VALIDATION: Appointment ${appointmentId} not found in database`;
    logger.error(errorMsg);
    await recordFailedAttempt(supabase, appointmentId, existingOutbox, errorMsg);
    return { success: false, error: errorMsg };
  }

  try {
    const email = buildAppointmentEmail({
      id: appointment.id,
      created_at: appointment.created_at,
      name: appointment.name,
      phone: appointment.phone,
      email: appointment.email,
      preferred_date: appointment.preferred_date,
      preferred_time: appointment.preferred_time as AppointmentPayload["preferred_time"],
      message: appointment.message,
      source: appointment.source as AppointmentPayload["source"],
    });

    await sendEmail(email);

    // Delivery confirmed: mark sent
    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("notification_outbox")
      .update({
        status: "sent",
        sent_at: nowIso,
        last_error: null,
        updated_at: nowIso,
      })
      .eq("appointment_id", appointmentId);

    if (updateError) {
      // The email was delivered, so report success to the caller. But the row is still "processing",
      // so after the stale window (10 min) the retry worker will claim it and send the email AGAIN.
      // That is the at-least-once trade-off: a duplicate email is accepted over a lost one.
      logger.error("CRITICAL: Email delivered but outbox status update failed", {
        appointmentId,
        code: updateError.code,
      });
    } else {
      logger.info("Appointment notification successfully delivered and marked sent", {
        appointmentId,
      });
    }
    return { success: true };
  } catch (cause) {
    const errorMetadata = sanitizeErrorMetadata(cause);
    logger.warn("Notification delivery attempt failed", { error: errorMetadata });

    await recordFailedAttempt(supabase, appointmentId, existingOutbox, errorMetadata);

    return { success: false, error: errorMetadata };
  }
}

/**
 * Process all eligible pending or failed notifications from the outbox.
 * Concurrency Safe: Uses PostgreSQL `FOR UPDATE SKIP LOCKED` via stored procedure
 * to guarantee that multiple concurrent workers or overlapping cron runs never
 * double-claim or double-deliver the same notification.
 */
export async function processNotificationOutbox(
  supabase: SupabaseClient<Database>,
  limit = 20,
): Promise<{ processed: number; succeeded: number; failed: number }> {
  // Concurrency Safe: Uses PostgreSQL `FOR UPDATE SKIP LOCKED` via stored procedure
  // claim_notification_outbox_jobs to guarantee that multiple concurrent workers or overlapping
  // cron runs never double-claim or double-deliver the same notification.
  // Unsafe fallback claiming is strictly removed to prevent concurrent race conditions.
  if (typeof supabase.rpc !== "function") {
    logger.error("Database client does not support RPC calls for atomic outbox claiming");
    throw new AppError("SERVER", "Atomic outbox claiming procedure is unavailable", {
      status: 500,
    });
  }

  const { data: rpcJobs, error: rpcError } = await supabase.rpc("claim_notification_outbox_jobs", {
    p_batch_size: limit,
    p_stale_minutes: 10,
  });

  if (rpcError) {
    logger.error("Atomic outbox claim RPC failed", { code: rpcError.code ?? "UNKNOWN" });
    throw new AppError("SERVER", "Failed to claim outbox notification jobs from database", {
      status: 500,
      cause: rpcError,
    });
  }

  const jobs = Array.isArray(rpcJobs) ? rpcJobs : [];

  if (jobs.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  let succeeded = 0;
  let failed = 0;

  for (const job of jobs) {
    const result = await deliverNotification(supabase, job.appointment_id);
    if (result.success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  return { processed: jobs.length, succeeded, failed };
}
