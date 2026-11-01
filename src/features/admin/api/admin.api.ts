/**
 * Browser-side client for the staff admin endpoints (`/api/admin/*`).
 *
 * Built on the shared `apiRequest`, so every failure is an `AppError` (with a timeout) whose
 * `status` lets the UI tell "session expired" (401) from "not staff" (403) from "something broke"
 * instead of treating them all as a silent empty table.
 */
import { ADMIN_APPOINTMENTS_ENDPOINT, ADMIN_RETRY_OUTBOX_ENDPOINT } from "@/api/endpoints";
import { apiRequest } from "@/api/http-client";
import type { AppointmentPage, AppointmentStatus, RetryOutboxResult, StatusFilter } from "../types";

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

type ListParams = { page: number; pageSize: number; status: StatusFilter; search: string };

export function fetchAppointments(token: string, params: ListParams): Promise<AppointmentPage> {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    status: params.status,
    search: params.search,
  });
  return apiRequest<AppointmentPage>(`${ADMIN_APPOINTMENTS_ENDPOINT}?${query.toString()}`, {
    headers: bearer(token),
  });
}

export function updateAppointmentStatus(
  token: string,
  id: string,
  status: AppointmentStatus,
): Promise<{ id: string; status: string; updated: boolean }> {
  return apiRequest(ADMIN_APPOINTMENTS_ENDPOINT, {
    method: "PATCH",
    headers: bearer(token),
    body: { id, status },
  });
}

export function retryOutbox(token: string): Promise<RetryOutboxResult> {
  return apiRequest<RetryOutboxResult>(ADMIN_RETRY_OUTBOX_ENDPOINT, {
    method: "POST",
    headers: bearer(token),
  });
}
