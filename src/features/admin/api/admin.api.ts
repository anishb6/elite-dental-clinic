/**
 * Browser-side client for the staff admin endpoints (`/api/admin/*`).
 *
 * Every failure becomes an `AdminApiError` carrying the HTTP status, so the UI can tell
 * "session expired" (401) from "not staff" (403) from "something broke" (anything else) instead of
 * treating them all as a silent empty table.
 */
import type { AppointmentPage, AppointmentStatus, RetryOutboxResult, StatusFilter } from "../types";

export class AdminApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

type Envelope<T> = { ok: boolean; data?: T; error?: { message?: string } };

async function request<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new AdminApiError("Network error. Check your connection and try again.", 0);
  }

  let body: Envelope<T> | null = null;
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    // Non-JSON body (e.g. a proxy error page): fall through to the generic message below.
  }

  if (!response.ok || !body?.ok || body.data === undefined) {
    throw new AdminApiError(
      body?.error?.message ?? `Request failed (HTTP ${response.status}).`,
      response.status,
    );
  }
  return body.data;
}

export type ListParams = { page: number; pageSize: number; status: StatusFilter; search: string };

export function fetchAppointments(token: string, params: ListParams): Promise<AppointmentPage> {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    status: params.status,
    search: params.search,
  });
  return request<AppointmentPage>(token, `/api/admin/appointments?${query.toString()}`);
}

export function updateAppointmentStatus(
  token: string,
  id: string,
  status: AppointmentStatus,
): Promise<{ id: string; status: string; updated: boolean }> {
  return request(token, "/api/admin/appointments", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status }),
  });
}

export function retryOutbox(token: string): Promise<RetryOutboxResult> {
  return request<RetryOutboxResult>(token, "/api/admin/retry-outbox", { method: "POST" });
}
