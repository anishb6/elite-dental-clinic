/**
 * @deprecated Email notifications are now handled directly on the server by
 * the trusted server-side booking flow (POST /api/create-appointment).
 *
 * Direct browser calls to /api/notify-appointment are discontinued to protect
 * patient privacy, avoid arbitrary email spoofing, and prevent exposing NOTIFY_SECRET.
 */
import { apiRequest } from "@/api/http-client";
import { NOTIFY_ENDPOINT } from "../constants";

export function notifyClinic(appointmentId: string): Promise<{ sent: boolean }> {
  return apiRequest<{ sent: boolean }>(NOTIFY_ENDPOINT, {
    method: "POST",
    body: { appointment_id: appointmentId },
  });
}
