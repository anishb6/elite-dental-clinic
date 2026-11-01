import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { marker: "admin" } }));

import { getAdminClient, tryGetAdminClient } from "./database.server";

afterEach(() => vi.unstubAllEnvs());

describe("getAdminClient", () => {
  it("returns the service-role client when configured", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "key");
    await expect(getAdminClient("unavailable")).resolves.toEqual({ marker: "admin" });
  });

  it("throws a CONFIG error carrying the caller's visitor-safe message when unconfigured", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    await expect(getAdminClient("Service unavailable.")).rejects.toMatchObject({
      code: "CONFIG",
      status: 500,
      userMessage: "Service unavailable.",
    });
  });
});

describe("tryGetAdminClient", () => {
  it("returns null instead of throwing when unconfigured", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    await expect(tryGetAdminClient()).resolves.toBeNull();
  });
});
