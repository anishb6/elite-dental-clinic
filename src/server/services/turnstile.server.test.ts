/**
 * Regression tests for Turnstile verification (fail-closed + no production bypass).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyTurnstileToken } from "./turnstile.server";

const DUMMY_PASS_TOKENS = ["XXXX.DUMMY.TOKEN.PASSXXXX", "1x00000000000000000000AA"];
const DUMMY_FAIL_TOKENS = ["XXXX.DUMMY.TOKEN.FAILXXXX", "2x00000000000000000000AA"];

const fetchMock = vi.fn();

function cloudflareReplies(body: Record<string, unknown>, status = 200) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

/** Simulate a production runtime that has a real secret configured. */
function asProduction(secret = "prod-secret") {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VITEST", "");
  vi.stubEnv("TURNSTILE_SECRET_KEY", secret);
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("verifyTurnstileToken - missing secret", () => {
  it("fails closed with a 500 CONFIG error in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VITEST", "");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");

    await expect(verifyTurnstileToken("anything", "203.0.113.7")).rejects.toMatchObject({
      code: "CONFIG",
      status: 500,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed when NODE_ENV is not an explicit development/test value", async () => {
    vi.stubEnv("NODE_ENV", "staging");
    vi.stubEnv("VITEST", "");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "   ");

    await expect(verifyTurnstileToken("anything")).rejects.toMatchObject({ code: "CONFIG" });
  });

  it.each(["test", "development"])("allows the bypass only in explicit %s runs", async (env) => {
    vi.stubEnv("NODE_ENV", env);
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");

    await expect(verifyTurnstileToken(undefined)).resolves.toEqual({ success: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("verifyTurnstileToken - production with a real secret", () => {
  it.each([...DUMMY_PASS_TOKENS, ...DUMMY_FAIL_TOKENS])(
    "never short-circuits on the Cloudflare dummy token %s",
    async (token) => {
      asProduction();
      cloudflareReplies({ success: false, "error-codes": ["invalid-input-response"] });

      const result = await verifyTurnstileToken(token, "203.0.113.7");

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(result.success).toBe(false);
    },
  );

  it("does not treat the dummy pass token as valid even in a non-dev, non-production env", async () => {
    vi.stubEnv("NODE_ENV", "staging");
    vi.stubEnv("VITEST", "");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "staging-secret");
    cloudflareReplies({ success: false, "error-codes": ["invalid-input-response"] });

    const result = await verifyTurnstileToken(DUMMY_PASS_TOKENS[0]);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.success).toBe(false);
  });

  it("accepts a token only when Cloudflare confirms it, sending secret, token and client IP", async () => {
    asProduction("prod-secret");
    cloudflareReplies({ success: true });

    const result = await verifyTurnstileToken("real-widget-token", "203.0.113.7");

    expect(result.success).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: URLSearchParams }];
    expect(url).toContain("challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(init.body.get("secret")).toBe("prod-secret");
    expect(init.body.get("response")).toBe("real-widget-token");
    expect(init.body.get("remoteip")).toBe("203.0.113.7");
  });

  it("rejects a missing token without calling Cloudflare", async () => {
    asProduction();

    const result = await verifyTurnstileToken("  ");

    expect(result).toEqual({ success: false, errorCodes: ["missing-input-response"] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps an upstream Cloudflare error to a 502 UPSTREAM error", async () => {
    asProduction();
    cloudflareReplies({}, 500);

    await expect(verifyTurnstileToken("real-widget-token")).rejects.toMatchObject({
      code: "UPSTREAM",
      status: 502,
    });
  });

  it("fails closed (success=false) on a network failure", async () => {
    asProduction();
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(verifyTurnstileToken("real-widget-token")).resolves.toEqual({
      success: false,
      errorCodes: ["network-failure"],
    });
  });
});

describe("verifyTurnstileToken - explicit test environment", () => {
  it("still honours the Cloudflare dummy tokens (local development / CI only)", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");

    await expect(verifyTurnstileToken(DUMMY_PASS_TOKENS[0])).resolves.toEqual({ success: true });
    await expect(verifyTurnstileToken(DUMMY_FAIL_TOKENS[0])).resolves.toMatchObject({
      success: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
