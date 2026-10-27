import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { apiRequest } from "./http-client";

afterEach(() => vi.unstubAllGlobals());

const stubFetch = (impl: () => Promise<Response>) => vi.stubGlobal("fetch", vi.fn(impl));

describe("apiRequest", () => {
  it("unwraps the success envelope", async () => {
    stubFetch(async () => Response.json({ ok: true, data: { sent: true } }));
    await expect(apiRequest("/api/x", { method: "POST", body: {} })).resolves.toEqual({
      sent: true,
    });
  });

  it("throws a typed error for a failure envelope", async () => {
    stubFetch(async () =>
      Response.json({ ok: false, error: { code: "VALIDATION", message: "no" } }, { status: 400 }),
    );
    await expect(apiRequest("/api/x")).rejects.toMatchObject({ code: "VALIDATION", status: 400 });
  });

  it("surfaces the server's visitor-safe message as the error's userMessage", async () => {
    stubFetch(async () =>
      Response.json(
        {
          ok: false,
          error: { code: "SERVER", message: "Something went wrong. Please call us instead." },
        },
        { status: 500 },
      ),
    );
    await expect(apiRequest("/api/x")).rejects.toMatchObject({
      code: "SERVER",
      userMessage: "Something went wrong. Please call us instead.",
    });
  });

  it("handles non-JSON error pages", async () => {
    stubFetch(async () => new Response("<html>oops</html>", { status: 500 }));
    await expect(apiRequest("/api/x")).rejects.toBeInstanceOf(AppError);
  });

  it("reports network failures", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(apiRequest("/api/x")).rejects.toMatchObject({ code: "NETWORK" });
  });
});
