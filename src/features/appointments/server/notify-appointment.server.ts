/**
 * POST /api/notify-appointment - internal notification endpoint.
 *
 * ⚠️  INTERNAL ENDPOINT — no longer called from the browser.
 * New bookings automatically trigger notifications via POST /api/create-appointment.
 *
 * Security:
 *  - Protected by `X-Notify-Secret` header matching `NOTIFY_SECRET`.
 *  - Does NOT accept arbitrary client-supplied appointment data.
 *  - Verifies that the appointment exists in Supabase by `appointment_id` (UUID).
 *  - Verifies the appointment is eligible (status = 'new') to avoid duplicate/inappropriate notifications.
 *  - Email content is constructed exclusively from the verified database record.
 */
import { AppError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { parseJsonBody } from "@/server/http/parse-body";
import { jsonOk } from "@/server/http/responses";
import { sendEmail } from "@/server/services/email.server";
import { notifyAppointmentRequestSchema, type AppointmentPayload } from "../schemas";
import { buildAppointmentEmail } from "./appointment-email.server";

const logger = createLogger("notify-appointment");

export async function handleNotifyAppointment(request: Request): Promise<Response> {
  checkNotifySecret(request);

  const { appointment_id } = await parseJsonBody(request, notifyAppointmentRequestSchema);

  const supabase = await getDatabaseClient();
  const { data: appointment, error } = await supabase
    .from("appointments")
    .select(
      "id, created_at, name, phone, email, preferred_date, preferred_time, message, source, status",
    )
    .eq("id", appointment_id)
    .single();

  if (error || !appointment) {
    throw new AppError("VALIDATION", `Appointment not found: ${appointment_id}`, {
      status: 404,
      userMessage: "Appointment not found.",
    });
  }

  // Prevent duplicate or invalid notifications for non-pending appointments
  if (appointment.status !== "new") {
    logger.warn("Notification skipped: appointment is not eligible", {
      status: appointment.status,
    });
    return jsonOk({ sent: false, reason: "Appointment is not eligible for notification" });
  }

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
  return jsonOk({ sent: true, appointment_id });
}

async function getDatabaseClient() {
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!serviceRoleKey || serviceRoleKey.trim() === "") {
    logger.error("SUPABASE_SERVICE_ROLE_KEY is not configured on the server");
    throw new AppError(
      "CONFIG",
      "Server database configuration is missing: SUPABASE_SERVICE_ROLE_KEY is not set",
      {
        status: 500,
        userMessage: "Notification service is unavailable.",
      },
    );
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * Verify the shared secret supplied in `X-Notify-Secret`.
 *
 * Uses a constant-time comparison to avoid timing attacks.
 * If `NOTIFY_SECRET` is not configured or empty, the request is rejected with 500 CONFIG.
 * Authentication is never skipped.
 */
function checkNotifySecret(request: Request): void {
  const expected = process.env["NOTIFY_SECRET"];
  if (!expected || expected.trim() === "") {
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

/** Constant-time string comparison (avoids timing side-channels). */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
