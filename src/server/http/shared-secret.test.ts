import { afterEach, describe, expect, it, vi } from "vitest";
import { constantTimeEqual, requireNotifySecret } from "./shared-secret";

const request = (secret?: string) =>
  new Request("https://example.test/x", {
    method: "POST",
    headers: secret === undefined ? {} : { "x-notify-secret": secret },
  });

afterEach(() => vi.unstubAllEnvs());

describe("constantTimeEqual", () => {
  it("compares by value and length", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
  });
});

describe("requireNotifySecret", () => {
  it("accepts the configured secret", () => {
    vi.stubEnv("NOTIFY_SECRET", "s3cret");
    expect(() => requireNotifySecret(request("s3cret"))).not.toThrow();
  });

  it("rejects a missing or wrong header with 401", () => {
    vi.stubEnv("NOTIFY_SECRET", "s3cret");
    expect(() => requireNotifySecret(request())).toThrowError(
      expect.objectContaining({ status: 401 }),
    );
    expect(() => requireNotifySecret(request("nope"))).toThrowError(
      expect.objectContaining({ status: 401 }),
    );
  });

  it("fails closed with a 500 CONFIG error when no secret is configured", () => {
    vi.stubEnv("NOTIFY_SECRET", "  ");
    expect(() => requireNotifySecret(request("anything"))).toThrowError(
      expect.objectContaining({ code: "CONFIG", status: 500 }),
    );
  });
});
