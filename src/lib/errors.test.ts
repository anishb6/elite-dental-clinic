import { describe, expect, it } from "vitest";
import { AppError, getUserMessage, statusForError, toAppError } from "./errors";

describe("errors", () => {
  it("keeps AppError instances intact", () => {
    const error = new AppError("VALIDATION", "bad", { userMessage: "Fix it" });
    expect(toAppError(error)).toBe(error);
    expect(getUserMessage(error)).toBe("Fix it");
  });

  it("wraps unknown throwables without leaking their message to users", () => {
    const wrapped = toAppError(new Error("db password wrong"));
    expect(wrapped.code).toBe("UNKNOWN");
    expect(wrapped.userMessage).not.toContain("password");
    expect(getUserMessage("boom", "fallback")).toBe("fallback");
  });

  it("maps error codes to HTTP statuses", () => {
    expect(statusForError(new AppError("VALIDATION", "x"))).toBe(400);
    expect(statusForError(new AppError("RATE_LIMIT", "x"))).toBe(429);
    expect(statusForError(new AppError("UPSTREAM", "x"))).toBe(502);
    expect(statusForError(new AppError("TIMEOUT", "x"))).toBe(504);
    expect(statusForError(new AppError("SERVER", "x", { status: 503 }))).toBe(503);
  });
});
