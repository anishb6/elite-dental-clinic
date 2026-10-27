import type { z } from "zod";
import { AppError } from "@/lib/errors";

/** 64 KiB - generous for any appointment JSON, blocks multi-MB payloads. */
const MAX_BODY_BYTES = 65_536;

/**
 * Parse and validate a JSON request body, throwing a 400 `AppError` on any
 * problem. Enforces a body-size limit before parsing.
 */
export async function parseJsonBody<S extends z.ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<z.infer<S>> {
  const contentType = request.headers.get("content-type");
  if (
    contentType &&
    !contentType.toLowerCase().includes("application/json") &&
    contentType !== "text/plain;charset=UTF-8"
  ) {
    throw new AppError("VALIDATION", `Unsupported content-type: ${contentType}`, {
      status: 415,
      userMessage: "Content-Type must be application/json.",
    });
  }

  // Enforce a maximum body size before reading anything into memory.
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) > MAX_BODY_BYTES) {
    throw new AppError("VALIDATION", `Request body too large (content-length ${contentLength})`, {
      status: 413,
      userMessage: "Request too large.",
    });
  }

  let raw: unknown;
  try {
    // Read as text first so we can apply a byte-length guard even when
    // content-length is absent (chunked transfer, etc.).
    const text = await request.text();
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
      throw new AppError("VALIDATION", "Request body exceeds size limit", {
        status: 413,
        userMessage: "Request too large.",
      });
    }
    raw = JSON.parse(text);
  } catch (cause) {
    if (cause instanceof AppError) throw cause;
    throw new AppError("VALIDATION", "Request body is not valid JSON", {
      status: 400,
      cause,
      userMessage: "Invalid request.",
    });
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new AppError(
      "VALIDATION",
      `Invalid request body: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      { status: 400, userMessage: "Please check the details you entered." },
    );
  }
  return result.data;
}
