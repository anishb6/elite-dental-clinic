import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockAppointmentsSelect = vi.fn();
const mockAppointmentsUpdate = vi.fn();
const mockOutboxSelect = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: {
      getUser: (token: string) => mockGetUser(token),
    },
    from: (table: string) => {
      if (table === "appointments") {
        return {
          select: mockAppointmentsSelect,
          update: mockAppointmentsUpdate,
        };
      }
      if (table === "notification_outbox") {
        return {
          select: mockOutboxSelect,
        };
      }
      return {};
    },
  },
}));

vi.mock("@/features/appointments/server/notification-outbox.server", () => ({
  processNotificationOutbox: vi.fn().mockResolvedValue({ processed: 3, succeeded: 3, failed: 0 }),
}));

import {
  handleListAdminAppointments,
  handleRetryOutbox,
  handleUpdateAdminAppointmentStatus,
  verifyAdminSession,
} from "./admin-appointments.server";

describe("admin-appointments.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "admin-user-id",
          email: "staff@drdebayansaha.in",
          app_metadata: { role: "admin" },
        },
      },
      error: null,
    });
  });

  describe("verifyAdminSession", () => {
    it("throws 401 VALIDATION when authorization header is missing", async () => {
      const req = new Request("http://localhost/api/admin/appointments");
      await expect(verifyAdminSession(req)).rejects.toMatchObject({
        code: "VALIDATION",
        status: 401,
        userMessage: expect.stringContaining("clinic staff credentials"),
      });
    });

    it("throws 401 VALIDATION when token is not a Bearer token", async () => {
      const req = new Request("http://localhost/api/admin/appointments", {
        headers: { Authorization: "Basic dXNlcjpwYXNz" },
      });
      await expect(verifyAdminSession(req)).rejects.toMatchObject({
        code: "VALIDATION",
        status: 401,
      });
    });

    it("throws 401 VALIDATION when Supabase Auth rejects the token", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: "Invalid JWT token", status: 401 },
      });

      const req = new Request("http://localhost/api/admin/appointments", {
        headers: { Authorization: "Bearer expired-token" },
      });

      await expect(verifyAdminSession(req)).rejects.toMatchObject({
        code: "VALIDATION",
        status: 401,
        userMessage: expect.stringContaining("Session expired"),
      });
    });

    it("returns authenticated staff user when token is valid and user has admin role", async () => {
      const req = new Request("http://localhost/api/admin/appointments", {
        headers: { Authorization: "Bearer valid-staff-token" },
      });

      const user = await verifyAdminSession(req);
      expect(user.id).toBe("admin-user-id");
      expect(user.email).toBe("staff@drdebayansaha.in");
    });

    it("throws 403 VALIDATION when valid Supabase user is not authorized staff", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: {
          user: {
            id: "unauthorized-patient-id",
            email: "random-patient@example.com",
            app_metadata: {},
          },
        },
        error: null,
      });

      const req = new Request("http://localhost/api/admin/appointments", {
        headers: { Authorization: "Bearer patient-jwt-token" },
      });

      await expect(verifyAdminSession(req)).rejects.toMatchObject({
        code: "VALIDATION",
        status: 403,
        userMessage: expect.stringContaining("Access forbidden: You do not have staff permissions"),
      });
    });

    it("throws 403 VALIDATION when valid Supabase user has user_metadata.role='admin' (untrusted client metadata)", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: {
          user: {
            id: "attacker-user-id",
            email: "attacker@example.com",
            app_metadata: {}, // no server role
            user_metadata: { role: "admin" }, // client-supplied metadata must be ignored
          },
        },
        error: null,
      });

      const req = new Request("http://localhost/api/admin/appointments", {
        headers: { Authorization: "Bearer forged-client-role-jwt" },
      });

      await expect(verifyAdminSession(req)).rejects.toMatchObject({
        code: "VALIDATION",
        status: 403,
        userMessage: expect.stringContaining("Access forbidden: You do not have staff permissions"),
      });
    });

    it("authorizes user when email is in the staff allowlist even without role in JWT metadata", async () => {
      const originalEnv = process.env["STAFF_EMAILS"];
      process.env["STAFF_EMAILS"] = "receptionist@drdebayansaha.in";

      try {
        mockGetUser.mockResolvedValueOnce({
          data: {
            user: {
              id: "staff-email-user-id",
              email: "receptionist@drdebayansaha.in",
              email_confirmed_at: "2026-10-01T09:00:00Z",
              app_metadata: {},
            },
          },
          error: null,
        });

        const req = new Request("http://localhost/api/admin/appointments", {
          headers: { Authorization: "Bearer receptionist-jwt" },
        });

        const user = await verifyAdminSession(req);
        expect(user.id).toBe("staff-email-user-id");
      } finally {
        if (originalEnv !== undefined) {
          process.env["STAFF_EMAILS"] = originalEnv;
        } else {
          delete process.env["STAFF_EMAILS"];
        }
      }
    });

    it.each([
      ["email_confirmed_at is missing", undefined],
      ["email_confirmed_at is null", null],
    ])("throws 403 when an allowlisted email is not verified (%s)", async (_label, confirmedAt) => {
      vi.stubEnv("STAFF_EMAILS", "receptionist@drdebayansaha.in");

      try {
        mockGetUser.mockResolvedValueOnce({
          data: {
            user: {
              id: "unverified-signup-id",
              email: "receptionist@drdebayansaha.in",
              email_confirmed_at: confirmedAt,
              app_metadata: {},
              user_metadata: { role: "admin" }, // must stay irrelevant
            },
          },
          error: null,
        });

        const req = new Request("http://localhost/api/admin/appointments", {
          headers: { Authorization: "Bearer unverified-signup-jwt" },
        });

        await expect(verifyAdminSession(req)).rejects.toMatchObject({
          code: "VALIDATION",
          status: 403,
        });
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it("does not admit a notification recipient or the clinic address when STAFF_EMAILS is unset", async () => {
      vi.stubEnv("STAFF_EMAILS", "");
      vi.stubEnv("NOTIFY_EMAIL", "clinic@example.com");

      try {
        mockGetUser.mockResolvedValueOnce({
          data: {
            user: {
              id: "notify-recipient-id",
              email: "clinic@example.com",
              email_confirmed_at: "2026-10-01T09:00:00Z",
              app_metadata: {},
            },
          },
          error: null,
        });

        const req = new Request("http://localhost/api/admin/appointments", {
          headers: { Authorization: "Bearer notify-recipient-jwt" },
        });

        await expect(verifyAdminSession(req)).rejects.toMatchObject({
          code: "VALIDATION",
          status: 403,
        });
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it("matches the allowlist case-insensitively for a verified email", async () => {
      vi.stubEnv("STAFF_EMAILS", "Receptionist@DrDebayanSaha.in");

      try {
        mockGetUser.mockResolvedValueOnce({
          data: {
            user: {
              id: "verified-staff-id",
              email: "RECEPTIONIST@drdebayansaha.in",
              email_confirmed_at: "2026-10-01T09:00:00Z",
              app_metadata: {},
            },
          },
          error: null,
        });

        const req = new Request("http://localhost/api/admin/appointments", {
          headers: { Authorization: "Bearer verified-staff-jwt" },
        });

        const user = await verifyAdminSession(req);
        expect(user.id).toBe("verified-staff-id");
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it("does not authorize a verified user whose app_metadata role is not admin/staff and who is not allowlisted", async () => {
      vi.stubEnv("STAFF_EMAILS", "receptionist@drdebayansaha.in");

      try {
        mockGetUser.mockResolvedValueOnce({
          data: {
            user: {
              id: "patient-id",
              email: "patient@example.com",
              email_confirmed_at: "2026-10-01T09:00:00Z",
              app_metadata: { role: "patient" },
              user_metadata: { role: "admin" },
            },
          },
          error: null,
        });

        const req = new Request("http://localhost/api/admin/appointments", {
          headers: { Authorization: "Bearer patient-jwt" },
        });

        await expect(verifyAdminSession(req)).rejects.toMatchObject({ status: 403 });
      } finally {
        vi.unstubAllEnvs();
      }
    });
  });

  describe("handleListAdminAppointments", () => {
    it("returns paginated appointments joined with outbox notification status", async () => {
      const sampleAppointments = [
        {
          id: "app-1",
          name: "Asha Roy",
          phone: "+919147718046",
          email: "asha@example.com",
          preferred_date: "2026-11-05",
          preferred_time: "Evening",
          message: "Checkup",
          source: "Google",
          status: "new",
          created_at: "2026-10-27T01:30:00Z",
        },
      ];

      type QueryChain = {
        order: (col: string, opts: unknown) => QueryChain;
        range: (
          from: number,
          to: number,
        ) => Promise<{
          data: typeof sampleAppointments;
          count: number;
          error: null;
        }>;
      };

      const queryChain: QueryChain = {
        order: vi.fn(() => queryChain),
        range: vi.fn().mockResolvedValue({
          data: sampleAppointments,
          count: 1,
          error: null,
        }),
      };

      mockAppointmentsSelect.mockReturnValue(queryChain);

      mockOutboxSelect.mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [{ appointment_id: "app-1", status: "sent", attempts: 1, last_error: null }],
          error: null,
        }),
      });

      const req = new Request("http://localhost/api/admin/appointments?page=1&pageSize=10", {
        headers: { Authorization: "Bearer valid-token" },
      });

      const res = await handleListAdminAppointments(req);
      expect(res.status).toBe(200);

      const json = (await res.json()) as {
        ok: boolean;
        data: {
          totalCount: number;
          appointments: Array<{ notification: { status: string } }>;
        };
      };
      expect(json.ok).toBe(true);
      expect(json.data.totalCount).toBe(1);
      expect(json.data.appointments[0]?.notification.status).toBe("sent");
    });
  });

  describe("handleUpdateAdminAppointmentStatus", () => {
    it("updates appointment status successfully for valid status values", async () => {
      mockAppointmentsUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      const validUuid = "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d";
      const req = new Request("http://localhost/api/admin/appointments", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-token",
        },
        body: JSON.stringify({ id: validUuid, status: "confirmed" }),
      });

      const res = await handleUpdateAdminAppointmentStatus(req);
      expect(res.status).toBe(200);

      const json = (await res.json()) as {
        ok: boolean;
        data: { updated: boolean; status: string };
      };
      expect(json.ok).toBe(true);
      expect(json.data.updated).toBe(true);
      expect(json.data.status).toBe("confirmed");
    });

    it("rejects invalid status values with 400 VALIDATION error", async () => {
      const validUuid = "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d";
      const req = new Request("http://localhost/api/admin/appointments", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-token",
        },
        body: JSON.stringify({ id: validUuid, status: "invalid_status_value" }),
      });

      await expect(handleUpdateAdminAppointmentStatus(req)).rejects.toMatchObject({
        code: "VALIDATION",
        status: 400,
      });
    });
  });

  describe("handleRetryOutbox", () => {
    it("triggers outbox batch retry and returns processed counts", async () => {
      const req = new Request("http://localhost/api/admin/retry-outbox", {
        method: "POST",
        headers: { Authorization: "Bearer valid-token" },
      });

      const res = await handleRetryOutbox(req);
      expect(res.status).toBe(200);

      const json = (await res.json()) as {
        ok: boolean;
        data: { processed: number };
      };
      expect(json.ok).toBe(true);
      expect(json.data.processed).toBe(3);
    });
  });
});

describe("sanitizeSearchTerm (PostgREST filter-injection guard)", () => {
  it("passes ordinary names and phone numbers through", async () => {
    const { sanitizeSearchTerm } = await import("./admin-appointments.server");
    expect(sanitizeSearchTerm("Asha Roy")).toBe("Asha Roy");
    expect(sanitizeSearchTerm("+91 91477 18046")).toBe("+91 91477 18046");
    expect(sanitizeSearchTerm("O'Brien-Das")).toBe("O'Brien-Das");
    expect(sanitizeSearchTerm("অনিন্দ্য")).toBe("অনিন্দ্য");
  });

  it("strips the characters that could add filters, groups or wildcards", async () => {
    const { sanitizeSearchTerm } = await import("./admin-appointments.server");
    const injected = sanitizeSearchTerm("x%,status.eq.new),(name.ilike.*");
    expect(injected).not.toMatch(/[,()%*_"\\]/);
    expect(sanitizeSearchTerm('a"b\\c_d')).toBe("abcd");
  });

  it("returns an empty string for blank, missing or symbol-only input", async () => {
    const { sanitizeSearchTerm } = await import("./admin-appointments.server");
    expect(sanitizeSearchTerm(null)).toBe("");
    expect(sanitizeSearchTerm(undefined)).toBe("");
    expect(sanitizeSearchTerm("   ")).toBe("");
    expect(sanitizeSearchTerm("%,()")).toBe("");
  });

  it("caps the length", async () => {
    const { sanitizeSearchTerm } = await import("./admin-appointments.server");
    expect(sanitizeSearchTerm("a".repeat(500))).toHaveLength(50);
  });
});
