/**
 * Application error model.
 *
 * Every failure that crosses a module boundary (API call, DB insert, server
 * handler) is normalised into an `AppError` so that callers can:
 *   - branch on a stable `code`,
 *   - show a safe, human-friendly `userMessage`,
 *   - log the technical `message` / `cause` without leaking it to the UI.
 */

export type ErrorCode =
  | "VALIDATION" // input rejected (400)
  | "NETWORK" // request never reached the server
  | "TIMEOUT" // request took too long
  | "SERVER" // our own backend failed
  | "UPSTREAM" // a third-party service failed (e.g. Resend)
  | "CONFIG" // missing / invalid environment configuration
  | "RATE_LIMIT" // rate limit exceeded (429)
  | "UNKNOWN";

export const DEFAULT_USER_MESSAGE = "Something went wrong. Please try again or call us.";

export type AppErrorOptions = {
  status?: number | undefined;
  userMessage?: string | undefined;
  cause?: unknown;
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number | undefined;
  readonly userMessage: string;

  constructor(code: ErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.status = options.status;
    this.userMessage = options.userMessage ?? DEFAULT_USER_MESSAGE;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

/** Normalise anything that was thrown into an `AppError`. */
export function toAppError(error: unknown, fallbackUserMessage?: string): AppError {
  if (isAppError(error)) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new AppError("UNKNOWN", message, {
    userMessage: fallbackUserMessage,
    cause: error,
  });
}

/** HTTP status carried by an `AppError` (e.g. 401 for an expired session), else `null`. */
export function getErrorStatus(error: unknown): number | null {
  return isAppError(error) ? (error.status ?? null) : null;
}

/** Safe text to show a visitor for any thrown value. */
export function getUserMessage(error: unknown, fallback = DEFAULT_USER_MESSAGE): string {
  return isAppError(error) ? error.userMessage : fallback;
}

/** Map an `ErrorCode` to the HTTP status a server handler should return. */
export function statusForError(error: AppError): number {
  if (error.status) return error.status;
  switch (error.code) {
    case "VALIDATION":
      return 400;
    case "RATE_LIMIT":
      return 429;
    case "UPSTREAM":
      return 502;
    case "TIMEOUT":
      return 504;
    default:
      return 500;
  }
}
