/**
 * Browser-side HTTP client for this app's own `/api/*` routes.
 *
 * Responsibilities: JSON encoding, request timeout, and converting every
 * failure mode (offline, timeout, non-2xx, malformed body) into an `AppError`.
 * Feature code should call this through a small module in `features/<x>/api/`
 * rather than using `fetch` directly.
 */
import type { ApiResponse } from "@/api/types";
import { AppError } from "@/lib/errors";

const DEFAULT_TIMEOUT_MS = 10_000;

export type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Extra request headers (e.g. `Authorization` for staff endpoints). */
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  signal?.addEventListener("abort", () => controller.abort(), { once: true });

  let response: Response;
  try {
    const init: RequestInit = {
      method,
      signal: controller.signal,
    };
    if (headers || body !== undefined) {
      init.headers = {
        ...(body !== undefined && { "Content-Type": "application/json" }),
        ...headers,
      };
    }
    if (body !== undefined) init.body = JSON.stringify(body);
    response = await fetch(path, init);
  } catch (cause) {
    const timedOut = controller.signal.aborted && !signal?.aborted;
    throw new AppError(timedOut ? "TIMEOUT" : "NETWORK", `${method} ${path} failed to complete`, {
      cause,
      userMessage: timedOut
        ? "The request took too long. Please try again."
        : "Network error. Please check your connection and try again.",
    });
  } finally {
    clearTimeout(timer);
  }

  let payload: ApiResponse<T> | undefined;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    payload = undefined;
  }

  if (!response.ok || !payload || payload.ok === false) {
    const failure = payload && payload.ok === false ? payload.error : undefined;
    throw new AppError(
      failure?.code ?? "SERVER",
      `${method} ${path} responded with ${response.status}${failure ? `: ${failure.message}` : ""}`,
      {
        status: response.status,
        // The server only ever puts its visitor-safe `userMessage` in the envelope (see
        // server/http/responses.ts), so surface it instead of falling back to the generic default.
        userMessage: failure?.message,
      },
    );
  }

  return payload.data;
}
