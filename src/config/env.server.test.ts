import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getNotifyEnv,
  getServerDatabaseEnv,
  getStaffAllowlist,
  isEmailConfigured,
} from "./env.server";

describe("env.server", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getServerDatabaseEnv", () => {
    it("returns parsed database environment when valid", () => {
      process.env["SUPABASE_URL"] = "https://example.supabase.co";
      process.env["SUPABASE_SERVICE_ROLE_KEY"] = "service-role-secret";

      const env = getServerDatabaseEnv();
      expect(env.supabaseUrl).toBe("https://example.supabase.co");
      expect(env.supabaseServiceRoleKey).toBe("service-role-secret");
    });

    it("throws 500 CONFIG error when SUPABASE_SERVICE_ROLE_KEY is missing", () => {
      process.env["SUPABASE_URL"] = "https://example.supabase.co";
      delete process.env["SUPABASE_SERVICE_ROLE_KEY"];

      expect(() => getServerDatabaseEnv()).toThrowError(/SUPABASE_SERVICE_ROLE_KEY is required/);
    });

    it("throws 500 CONFIG error when SUPABASE_URL is invalid", () => {
      process.env["SUPABASE_URL"] = "not-a-url";
      process.env["SUPABASE_SERVICE_ROLE_KEY"] = "secret";

      expect(() => getServerDatabaseEnv()).toThrowError(/SUPABASE_URL must be a valid URL/);
    });
  });

  describe("isEmailConfigured", () => {
    it("returns true only when both RESEND_API_KEY and NOTIFY_EMAIL are present", () => {
      delete process.env["RESEND_API_KEY"];
      delete process.env["NOTIFY_EMAIL"];
      expect(isEmailConfigured()).toBe(false);

      process.env["RESEND_API_KEY"] = "re_12345";
      expect(isEmailConfigured()).toBe(false);

      process.env["NOTIFY_EMAIL"] = "clinic@example.com";
      expect(isEmailConfigured()).toBe(true);
    });
  });

  describe("getNotifyEnv", () => {
    it("parses multiple recipient addresses", () => {
      process.env["RESEND_API_KEY"] = "re_test_key";
      process.env["NOTIFY_EMAIL"] = "dr@example.com, staff@example.com ";

      const env = getNotifyEnv();
      expect(env.recipients).toEqual(["dr@example.com", "staff@example.com"]);
      expect(env.from).toContain("onboarding@resend.dev");
    });

    it("throws CONFIG error when required notification variables are missing", () => {
      delete process.env["RESEND_API_KEY"];
      delete process.env["NOTIFY_EMAIL"];

      expect(() => getNotifyEnv()).toThrowError(/Invalid server environment/);
    });
  });

  describe("getStaffAllowlist", () => {
    it("parses, trims and lower-cases STAFF_EMAILS", () => {
      process.env["STAFF_EMAILS"] = " Dr@Example.com , reception@example.com ,, ";
      expect(getStaffAllowlist()).toEqual(["dr@example.com", "reception@example.com"]);
    });

    it("fails closed (empty list) when STAFF_EMAILS is unset or blank", () => {
      delete process.env["STAFF_EMAILS"];
      expect(getStaffAllowlist()).toEqual([]);
      process.env["STAFF_EMAILS"] = "   ";
      expect(getStaffAllowlist()).toEqual([]);
    });

    it("never falls back to notification recipients or a built-in address", () => {
      delete process.env["STAFF_EMAILS"];
      process.env["NOTIFY_EMAIL"] = "clinic@example.com";
      process.env["CLINIC_NOTIFICATION_EMAIL"] = "other@example.com";
      expect(getStaffAllowlist()).toEqual([]);
    });

    it("ignores the retired ADMIN_EMAILS alias", () => {
      delete process.env["STAFF_EMAILS"];
      process.env["ADMIN_EMAILS"] = "alias@example.com";
      expect(getStaffAllowlist()).toEqual([]);
    });
  });
});
