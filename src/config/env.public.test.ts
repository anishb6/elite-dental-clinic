import { afterEach, describe, expect, it, vi } from "vitest";

async function loadPublicEnv() {
  vi.resetModules();
  return (await import("./env.public")).publicEnv;
}

describe("env.public: Turnstile site key", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads the single canonical variable VITE_CLOUDFLARE_TURNSTILE_SITE_KEY", async () => {
    vi.stubEnv("VITE_CLOUDFLARE_TURNSTILE_SITE_KEY", "  0x4AAAAAAAtest  ");
    const env = await loadPublicEnv();
    expect(env.turnstileSiteKey).toBe("0x4AAAAAAAtest");
  });

  it("does not honour the retired VITE_TURNSTILE_SITE_KEY alias", async () => {
    vi.stubEnv("VITE_CLOUDFLARE_TURNSTILE_SITE_KEY", "");
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "0x4AAAAAAAlegacy");
    const env = await loadPublicEnv();
    expect(env.turnstileSiteKey).toBeUndefined();
  });

  it("is undefined when nothing is configured", async () => {
    vi.stubEnv("VITE_CLOUDFLARE_TURNSTILE_SITE_KEY", "");
    const env = await loadPublicEnv();
    expect(env.turnstileSiteKey).toBeUndefined();
  });
});
