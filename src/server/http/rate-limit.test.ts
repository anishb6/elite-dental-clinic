import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { rateLimit, rateLimitShared } from "./rate-limit";
import { withApiHandler } from "./with-api-handler";

function req(ip?: string, cfIp?: string): Request {
  const headers = new Headers();
  if (cfIp) headers.set("cf-connecting-ip", cfIp);
  if (ip) headers.set("x-forwarded-for", ip);
  return new Request("http://localhost/test", { headers });
}

describe("rateLimit", () => {
  it("allows requests within the limit", () => {
    const request = req("192.168.1.1");
    expect(() => rateLimit(request, { windowMs: 10_000, max: 2, key: "test-allow" })).not.toThrow();
    expect(() => rateLimit(request, { windowMs: 10_000, max: 2, key: "test-allow" })).not.toThrow();
  });

  it("throws 429 RATE_LIMIT AppError when rate limit is exceeded", () => {
    const request = req("192.168.1.2");
    const options = { windowMs: 10_000, max: 2, key: "test-block" };

    rateLimit(request, options);
    rateLimit(request, options);

    try {
      rateLimit(request, options);
      expect.fail("Should have thrown rate limit error");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.code).toBe("RATE_LIMIT");
      expect(appErr.status).toBe(429);
      expect(appErr.userMessage).toContain("Too many requests");
    }
  });

  it("returns HTTP 429 JSON envelope when handled by withApiHandler", async () => {
    const request = req("192.168.1.99");
    const wrappedHandler = withApiHandler("test-rate-limit", async (r) => {
      rateLimit(r, { windowMs: 10_000, max: 1, key: "test-wrapped" });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    // 1st request -> 200
    const res1 = await wrappedHandler(request);
    expect(res1.status).toBe(200);

    // 2nd request -> 429
    const res2 = await wrappedHandler(request);
    expect(res2.status).toBe(429);
    const json = (await res2.json()) as { ok: boolean; error: { code: string; message: string } };
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("RATE_LIMIT");
    expect(json.error.message).toContain("Too many requests");
  });

  it("prefers cf-connecting-ip over x-forwarded-for", () => {
    const request1 = req("10.0.0.1", "203.0.113.5");
    const request2 = req("10.0.0.2", "203.0.113.5");
    const options = { windowMs: 10_000, max: 1, key: "test-cf-ip" };

    rateLimit(request1, options);
    // request2 has different x-forwarded-for but same cf-connecting-ip -> blocked
    expect(() => rateLimit(request2, options)).toThrowError();
  });

  it("extracts trusted IP from x-real-ip and x-forwarded-for", () => {
    const headers = new Headers();
    headers.set("x-real-ip", "198.51.100.42");
    const req1 = new Request("http://localhost/test", { headers });
    const options = { windowMs: 10_000, max: 1, key: "test-real-ip" };

    rateLimit(req1, options);
    expect(() => rateLimit(req1, options)).toThrowError();
  });

  it("tracks different keys independently", () => {
    const request = req("192.168.1.3");
    rateLimit(request, { windowMs: 10_000, max: 1, key: "endpoint-a" });
    expect(() => rateLimit(request, { windowMs: 10_000, max: 1, key: "endpoint-b" })).not.toThrow();
  });
});

describe("rateLimitShared", () => {
  it("allows request when database check_rate_limit returns allowed=true", async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const mockSupabase = { rpc: mockRpc } as unknown as Parameters<typeof rateLimitShared>[0];
    const request = req("203.0.113.10");

    await expect(
      rateLimitShared(mockSupabase, request, { windowMs: 60_000, max: 5, key: "test-shared" }),
    ).resolves.not.toThrow();

    expect(mockRpc).toHaveBeenCalledWith("check_rate_limit", {
      p_key: "test-shared:203.0.113.10",
      p_max: 5,
      p_window_seconds: 60,
    });
  });

  it("throws 429 when database check_rate_limit returns allowed=false", async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: false, error: null });
    const mockSupabase = { rpc: mockRpc } as unknown as Parameters<typeof rateLimitShared>[0];
    const request = req("203.0.113.11");

    await expect(
      rateLimitShared(mockSupabase, request, {
        windowMs: 60_000,
        max: 5,
        key: "test-shared-blocked",
      }),
    ).rejects.toThrowError(AppError);

    try {
      await rateLimitShared(mockSupabase, request, {
        windowMs: 60_000,
        max: 5,
        key: "test-shared-blocked",
      });
      expect.fail("Should have thrown AppError");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.code).toBe("RATE_LIMIT");
      expect(appErr.status).toBe(429);
      expect(appErr.userMessage).toContain("Too many requests");
    }
  });

  it("falls back safely to in-memory rate limiting when database RPC fails", async () => {
    const mockRpc = vi.fn().mockRejectedValue(new Error("Database connection timeout"));
    const mockSupabase = { rpc: mockRpc } as unknown as Parameters<typeof rateLimitShared>[0];
    const request = req("203.0.113.12");

    // Falls back to in-memory; first request passes
    await expect(
      rateLimitShared(mockSupabase, request, { windowMs: 60_000, max: 1, key: "test-fallback" }),
    ).resolves.not.toThrow();

    // Second request hits the in-memory rate limit and throws 429
    await expect(
      rateLimitShared(mockSupabase, request, { windowMs: 60_000, max: 1, key: "test-fallback" }),
    ).rejects.toThrowError(AppError);
  });
});

describe("rateLimitShared - degraded mode is never silent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const options = (key: string) => ({ windowMs: 60_000, max: 5, key });

  it("logs a warning with the RPC error code when the shared limiter is unavailable", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const mockRpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: "42883", message: "no such function" } });
    const supabase = { rpc: mockRpc } as unknown as Parameters<typeof rateLimitShared>[0];

    await rateLimitShared(supabase, req("203.0.113.40"), options("warn-rpc-error"));

    expect(warn).toHaveBeenCalledWith(
      "[rate-limit]",
      expect.stringContaining("per-instance"),
      expect.objectContaining({ reason: "rpc-error:42883", key: "warn-rpc-error" }),
    );
  });

  it("logs a warning when the RPC throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const supabase = {
      rpc: vi.fn().mockRejectedValue(new Error("timeout")),
    } as unknown as Parameters<typeof rateLimitShared>[0];

    await rateLimitShared(supabase, req("203.0.113.41"), options("warn-rpc-throw"));

    expect(warn).toHaveBeenCalledWith(
      "[rate-limit]",
      expect.any(String),
      expect.objectContaining({ reason: "rpc-exception" }),
    );
  });

  it("logs a warning when no database client is available", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await rateLimitShared(null, req("203.0.113.42"), options("warn-no-client"));

    expect(warn).toHaveBeenCalledWith(
      "[rate-limit]",
      expect.any(String),
      expect.objectContaining({ reason: "no-database-client" }),
    );
  });

  it("does not warn when the shared limiter answers normally", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    } as unknown as Parameters<typeof rateLimitShared>[0];

    await rateLimitShared(supabase, req("203.0.113.43"), options("no-warn"));

    expect(warn).not.toHaveBeenCalled();
  });

  it("does not fall back to the in-memory limiter when the shared limiter says 'blocked'", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    } as unknown as Parameters<typeof rateLimitShared>[0];

    await expect(
      rateLimitShared(supabase, req("203.0.113.44"), options("blocked-shared")),
    ).rejects.toMatchObject({ code: "RATE_LIMIT", status: 429 });
  });
});
