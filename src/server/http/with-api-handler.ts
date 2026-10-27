/**
 * Wraps an API route handler with uniform error handling and logging.
 *
 * Handlers just `throw new AppError(...)` (or let anything else bubble up) and
 * the wrapper turns it into a consistent `{ ok: false, error }` JSON response,
 * so no route needs its own try/catch or ad-hoc status codes.
 */
import { toAppError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { jsonError } from "./responses";

export function withApiHandler(
  name: string,
  handler: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  const logger = createLogger(name);
  return async (request) => {
    try {
      return await handler(request);
    } catch (error) {
      const appError = toAppError(error);
      // Sanitize logged details: never dump raw database causes that could echo submitted patient fields
      logger.error(appError.message, { code: appError.code, status: appError.status });
      return jsonError(appError);
    }
  };
}
