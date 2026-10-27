/**
 * Server-side appointment creation — validates, stores, and manages notification outbox.
 *
 * This handler runs purely on the server:
 *  - Strict server-side schema validation (rejects invalid dates, times, phones, malformed JSON).
 *  - Drops bot submissions using a honeypot field (`website`) and optional Cloudflare Turnstile verification.
 *  - Guards against duplicate replay submissions within a 2-minute window.
 *  - Inserts directly into Supabase with hardcoded status 'new' using trusted `service_role`.
 *  - Enqueues a persistent job in `public.notification_outbox` for durable email dispatch.
 *  - Immediately attempts initial delivery; if Resend fails, the outbox record retains failure metadata
 *    and schedules automatic retry, while the patient safely receives a booking confirmation.
 */
import { AppError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { parseJsonBody } from "@/server/http/parse-body";
import { getClientIp } from "@/server/http/rate-limit";
import { jsonOk } from "@/server/http/responses";
import { verifyTurnstileToken } from "@/server/services/turnstile.server";
import { BOOKING_ERROR_MESSAGE, DEFAULT_TREATMENT } from "../constants";
import { createAppointmentSchema, toAppointmentPayload } from "../schemas";
import { claimAndDeliverNotification } from "./notification-outbox.server";

const logger = createLogger("create-appointment");

export async function handleCreateAppointment(request: Request): Promise<Response> {
  const values = await parseJsonBody(request, createAppointmentSchema);

  // Honeypot check: real users never fill this field.
  // Silently return success to avoid tipping off bot operators.
  if (values.website) {
    logger.info("Bot submission detected via honeypot field; dropping request");
    return jsonOk({ id: "00000000-0000-0000-0000-000000000000", saved: true });
  }

  // Turnstile bot challenge verification (fails closed in production if secret is unconfigured)
  const clientIp = getClientIp(request);
  const turnstileResult = await verifyTurnstileToken(values.turnstile_token, clientIp);
  if (!turnstileResult.success) {
    logger.warn("Turnstile verification failed for booking submission", {
      errors: turnstileResult.errorCodes,
    });
    throw new AppError("VALIDATION", "Bot challenge verification failed. Please try again.", {
      status: 400,
      userMessage: "Bot verification check failed. Please refresh the page and try again.",
    });
  }

  const payload = toAppointmentPayload(values);
  const supabase = await getDatabaseClient();

  const appointmentId = crypto.randomUUID();

  // Strict Single-Transaction Atomic Booking:
  // Calls public.create_appointment_with_outbox which acquires a PostgreSQL advisory lock
  // (pg_advisory_xact_lock) on (phone, date, time) to eliminate concurrency race conditions,
  // checks for duplicates within the 2-minute window, and atomically inserts both the appointment
  // and notification outbox record in one transaction.
  // Sequential fallback is strictly removed: an appointment is NEVER created without its outbox entry.
  if (typeof supabase.rpc !== "function") {
    logger.error("Database client does not support RPC calls for atomic booking");
    throw new AppError(
      "SERVER",
      "Server database configuration error: atomic booking procedure is unavailable",
      {
        status: 500,
        userMessage: BOOKING_ERROR_MESSAGE,
      },
    );
  }

  const { data: committedId, error: rpcError } = await supabase.rpc(
    "create_appointment_with_outbox",
    {
      p_id: appointmentId,
      p_name: payload.name,
      p_phone: payload.phone,
      p_email: payload.email,
      p_treatment: DEFAULT_TREATMENT,
      p_preferred_date: payload.preferred_date,
      p_preferred_time: payload.preferred_time,
      p_message: payload.message,
      p_source: payload.source,
    },
  );

  if (rpcError) {
    logger.error("Atomic appointment booking transaction failed", {
      code: rpcError.code ?? "UNKNOWN",
    });
    throw new AppError(
      "SERVER",
      "Failed to save appointment request: database atomic booking error",
      {
        status: 500,
        userMessage: BOOKING_ERROR_MESSAGE,
        cause: rpcError,
      },
    );
  }

  const finalId = committedId || appointmentId;
  const isDuplicate = finalId !== appointmentId;

  if (isDuplicate) {
    logger.info(
      "Duplicate submission detected atomically within 2-minute window; returning existing ID",
      {
        id: finalId,
      },
    );
    return jsonOk({ id: finalId, saved: true, duplicate: true });
  }

  // Attempt initial delivery. If it fails, the outbox record retains failure metadata
  // and schedules automatic retry via background worker. Patient receives confirmation.
  try {
    await claimAndDeliverNotification(supabase, finalId);
  } catch (cause) {
    logger.warn("Initial notification dispatch encountered an error (appointment safely saved)", {
      code: cause instanceof AppError ? cause.code : "UNKNOWN",
    });
  }

  return jsonOk({ id: finalId, saved: true });
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
        userMessage: BOOKING_ERROR_MESSAGE,
      },
    );
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
