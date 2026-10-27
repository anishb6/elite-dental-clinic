import { useMutation } from "@tanstack/react-query";
import { track } from "@/lib/analytics";
import { getUserMessage, isAppError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { createAppointment } from "../api/appointments.api";
import { BOOKING_ERROR_MESSAGE } from "../constants";
import { toAppointmentPayload, type BookingFormValues } from "../schemas";

const logger = createLogger("booking");

/**
 * Orchestrates a booking: delegates creation and clinic notification to the
 * secure server-side endpoint.
 *
 * - Server failure  -> the mutation fails and the visitor sees `errorMessage`.
 * - Notification failure -> handled server-side without failing the saved booking.
 *
 * The mutation object is the single source of truth for the form's
 * idle / pending / success / error state (no hand-rolled status flags).
 */
export function useBookAppointment() {
  const mutation = useMutation({
    mutationFn: async (values: BookingFormValues & { turnstile_token?: string | undefined }) => {
      const payload = toAppointmentPayload(values);
      await createAppointment(payload);
      track("booking_submitted", {
        preferred_time: payload.preferred_time,
        source: payload.source ?? "unknown",
      });
    },
    onError: (error) => {
      // Log only the error code: the underlying DB error can echo the submitted row (phone, name…).
      logger.error("Booking failed", { code: isAppError(error) ? error.code : "UNKNOWN" });
      track("booking_failed");
    },
  });

  return {
    submit: mutation.mutate,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    errorMessage: mutation.isError ? getUserMessage(mutation.error, BOOKING_ERROR_MESSAGE) : null,
    reset: mutation.reset,
  };
}
