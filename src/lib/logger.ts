/**
 * Tiny scoped logger. One place to change if logs are later shipped to a
 * service such as Sentry. Server-side `console.error` is additionally wrapped by
 * `src/server/error-capture.ts` so stack traces survive h3's error swallowing.
 */
type LogFn = (message: string, ...details: unknown[]) => void;

export type Logger = { info: LogFn; warn: LogFn; error: LogFn };

export function createLogger(scope: string): Logger {
  const prefix = `[${scope}]`;
  return {
    info: (message, ...details) => console.info(prefix, message, ...details),
    warn: (message, ...details) => console.warn(prefix, message, ...details),
    error: (message, ...details) => console.error(prefix, message, ...details),
  };
}
