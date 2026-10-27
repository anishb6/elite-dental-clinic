import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn((_table?: string) => ({ select: mockSelect }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => mockFrom(table) },
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: (table: string) => mockFrom(table) },
}));

const sendEmail = vi.fn(async (_message: unknown) => undefined);
vi.mock("@/server/services/email.server", () => ({ sendEmail: (arg: unknown) => sendEmail(arg) }));

import { handleNotifyAppointment } from "./notify-appointment.server";

const testAppointmentId = "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d";

const sampleAppointmentRecord = {
  id: testAppointmentId,
  name: "Asha Roy",
  phone: "+919147718046",
  email: "asha@example.com",
  preferred_date: "2026-11-05",
  preferred_time: "Evening",
  message: "Tooth pain",
  source: "Google search",
  status: "new",
  created_at: "2026-10-27T01:30:00Z",
};

const TEST_NOTIFY_SECRET = "super-secret-token";
const originalSecret = process.env["NOTIFY_SECRET"];
const originalServiceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

function postNotify(body: unknown, headers: Record<string, string> = {}): Request {
  const mergedHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "x-notify-secret": TEST_NOTIFY_SECRET,
    ...headers,
  };
  // Allow explicitly deleting header by passing empty or deleting
  return new Request("http://test/api/notify-appointment", {
    method: "POST",
    headers: mergedHeaders,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env["NOTIFY_SECRET"] = TEST_NOTIFY_SECRET;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = "mock-service-role-key";
  mockFrom.mockClear();
  mockSelect.mockClear();
  mockEq.mockClear();
  mockSingle.mockReset().mockResolvedValue({ data: sampleAppointmentRecord, error: null });
  sendEmail.mockReset().mockResolvedValue(undefined);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-26T20:00:00Z")); // 27 Oct 01:30 IST
});

afterEach(() => {
  if (originalSecret !== undefined) {
    process.env["NOTIFY_SECRET"] = originalSecret;
  } else {
    delete process.env["NOTIFY_SECRET"];
  }
  if (originalServiceRoleKey !== undefined) {
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = originalServiceRoleKey;
  } else {
    delete process.env["SUPABASE_SERVICE_ROLE_KEY"];
  }
  vi.useRealTimers();
});

describe("handleNotifyAppointment (verified DB-backed notification)", () => {
  it("sends clinic notification email for an existing eligible appointment", async () => {
    const res = await handleNotifyAppointment(postNotify({ appointment_id: testAppointmentId }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; data: { sent: boolean } };
    expect(json.ok).toBe(true);
    expect(json.data.sent).toBe(true);

    // Verified appointment fetched from DB
    expect(mockFrom).toHaveBeenCalledWith("appointments");
    expect(mockEq).toHaveBeenCalledWith("id", testAppointmentId);

    // Verified email constructed from DB record (not client input)
    expect(sendEmail).toHaveBeenCalledOnce();
    const sent = sendEmail.mock.calls[0]?.[0] as { subject: string; html: string };
    expect(sent.subject).toContain("Asha Roy");
    expect(sent.html).toContain("+919147718046");
    expect(sent.html).not.toContain("Tooth pain");
    expect(sent.html).toContain("confidential — view in staff portal");
  });

  it("rejects invalid appointment ID format with 400", async () => {
    await expect(
      handleNotifyAppointment(postNotify({ appointment_id: "not-a-uuid" })),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      status: 400,
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("returns 404 when appointment does not exist in the database", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "Row not found" } });

    await expect(
      handleNotifyAppointment(postNotify({ appointment_id: testAppointmentId })),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      status: 404,
      userMessage: "Appointment not found.",
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("skips sending notification if appointment is not eligible (status != 'new')", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { ...sampleAppointmentRecord, status: "cancelled" },
      error: null,
    });

    const res = await handleNotifyAppointment(postNotify({ appointment_id: testAppointmentId }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.sent).toBe(false);
    expect(json.data.reason).toContain("not eligible");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  describe("authorization and configuration via NOTIFY_SECRET and server credentials", () => {
    it("fails safely with 500 CONFIG error when NOTIFY_SECRET is not configured on the server", async () => {
      delete process.env["NOTIFY_SECRET"];
      await expect(
        handleNotifyAppointment(postNotify({ appointment_id: testAppointmentId })),
      ).rejects.toMatchObject({
        code: "CONFIG",
        status: 500,
        userMessage: "Notification service is unavailable.",
      });
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("fails safely with 500 CONFIG error when NOTIFY_SECRET is empty string or whitespace", async () => {
      process.env["NOTIFY_SECRET"] = "   ";
      await expect(
        handleNotifyAppointment(postNotify({ appointment_id: testAppointmentId })),
      ).rejects.toMatchObject({
        code: "CONFIG",
        status: 500,
        userMessage: "Notification service is unavailable.",
      });
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("fails safely with 500 CONFIG error when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
      delete process.env["SUPABASE_SERVICE_ROLE_KEY"];
      await expect(
        handleNotifyAppointment(postNotify({ appointment_id: testAppointmentId })),
      ).rejects.toMatchObject({
        code: "CONFIG",
        status: 500,
        userMessage: "Notification service is unavailable.",
      });
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("rejects requests missing X-Notify-Secret with 401 Unauthorized", async () => {
      // Create request without x-notify-secret header
      const req = new Request("http://test/api/notify-appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointment_id: testAppointmentId }),
      });
      await expect(handleNotifyAppointment(req)).rejects.toMatchObject({
        code: "VALIDATION",
        status: 401,
        userMessage: "Unauthorized.",
      });
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("rejects requests with incorrect X-Notify-Secret with 401 Unauthorized", async () => {
      await expect(
        handleNotifyAppointment(
          postNotify({ appointment_id: testAppointmentId }, { "x-notify-secret": "wrong-secret" }),
        ),
      ).rejects.toMatchObject({
        code: "VALIDATION",
        status: 401,
        userMessage: "Unauthorized.",
      });
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("accepts requests with correct X-Notify-Secret with 200", async () => {
      const res = await handleNotifyAppointment(
        postNotify(
          { appointment_id: testAppointmentId },
          { "x-notify-secret": TEST_NOTIFY_SECRET },
        ),
      );
      expect(res.status).toBe(200);
      expect(sendEmail).toHaveBeenCalledOnce();
    });
  });
});
