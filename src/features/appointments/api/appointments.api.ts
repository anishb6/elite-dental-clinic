/**
 * Data-access layer for appointments.
 *
 * Appointment requests are created through the secure server-side
 * POST /api/create-appointment route, which validates the data on the server,
 * persists the record in Supabase, and dispatches notification emails.
 * Browser code never talks to the `appointments` table directly.
 */
import { apiRequest } from "@/api/http-client";
import { CREATE_APPOINTMENT_ENDPOINT } from "../constants";
import type { AppointmentPayload } from "../schemas";

export type CreateAppointmentResponse = {
  id: string;
  saved: boolean;
};

/** Persist a new appointment request via the secure server-side endpoint. */
export async function createAppointment(
  payload: AppointmentPayload,
): Promise<CreateAppointmentResponse> {
  return apiRequest<CreateAppointmentResponse>(CREATE_APPOINTMENT_ENDPOINT, {
    method: "POST",
    body: payload,
  });
}
