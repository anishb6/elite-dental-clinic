/** Builders for the `ApiResponse` envelope used by every `/api/*` route. */
import type { ApiFailure, ApiSuccess } from "@/api/types";
import { statusForError, type AppError } from "@/lib/errors";

export function jsonOk<T>(data: T, init?: ResponseInit): Response {
  const body: ApiSuccess<T> = { ok: true, data };
  return Response.json(body, init);
}

export function jsonError(error: AppError): Response {
  const body: ApiFailure = {
    ok: false,
    // `userMessage` is safe to expose; the technical `message` stays in the logs.
    error: { code: error.code, message: error.userMessage },
  };
  return Response.json(body, { status: statusForError(error) });
}
