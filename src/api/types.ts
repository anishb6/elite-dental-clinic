/**
 * Wire contract shared by the browser and the server.
 * Every `/api/*` route answers with this envelope, so clients have exactly one
 * response shape to handle.
 */
import type { ErrorCode } from "@/lib/errors";

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: { code: ErrorCode; message: string } };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
