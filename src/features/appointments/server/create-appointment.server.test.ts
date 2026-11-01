import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { PRIVACY_POLICY_VERSION } from "../constants";

const mockInsert = vi.fn();
const mockUpsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockRpc = vi.fn();

const mockFrom = vi.fn((_table?: string) => ({
  insert: mockInsert,
  upsert: mockUpsert,
  update: mockUpdate,
  select: mockSelect,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
    rpc: (name: string, args: unknown) => mockRpc(name, args),
  },
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => mockFrom(table),
    rpc: (name: string, args: unknown) => mockRpc(name, args),
  },
}));

/**
 * Stand-in for `from("notification_outbox").update(...)`. It is both awaitable (the plain
 * `.update().eq()` calls that record results) and chainable down to `.select()` (the atomic claim
 * `.update().eq().in().lte().select("id")`). `claimedRows` is what the claim returns: one row
 * means "we won the job", none means another worker already owns it.
 */
type UpdateChain = PromiseLike<{ data: null; error: null }> & {
  eq: () => UpdateChain;
  in: () => UpdateChain;
  lte: () => UpdateChain;
  select: () => Promise<{ data: { id: string }[]; error: null }>;
};
function updateChain(claimedRows: { id: string }[] = [{ id: "outbox-123" }]): UpdateChain {
  const result = { data: null, error: null } as const;
  const chain: UpdateChain = {
    eq: () => chain,
    in: () => chain,
    lte: () => chain,
    select: () => Promise.resolve({ data: claimedRows, error: null }),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  };
  return chain;
}

const sendEmail = vi.fn(async (_message: unknown) => undefined);
vi.mock("@/server/services/email.server", () => ({ sendEmail: (arg: unknown) => sendEmail(arg) }));

import { handleCreateAppointment } from "./create-appointment.server";

const validBody = {
  name: "Asha Roy",
  phone: "91477 18046",
  email: "asha@example.com",
  preferred_date: "2026-11-05",
  preferred_time: "Evening",
  message: "Routine dental checkup",
  source: "Google search",
  privacy_consent: true,
};

function postRequest(payload: unknown): Request {
  return new Request("http://test/api/create-appointment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

const originalServiceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

beforeEach(() => {
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = "mock-service-role-key";
  process.env["RESEND_API_KEY"] = "re_test_key";
  process.env["NOTIFY_EMAIL"] = "clinic@example.com";

  mockInsert.mockReset().mockResolvedValue({ error: null });
  mockRpc.mockReset().mockImplementation((name: string, args: Record<string, unknown>) => {
    if (name === "create_appointment_with_outbox") {
      return Promise.resolve({ data: args?.["p_id"] || "mock-appointment-uuid", error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });
  mockUpsert.mockReset().mockReturnValue({
    select: vi.fn(() => ({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "outbox-123" }, error: null }),
    })),
  });
  mockUpdate.mockReset().mockImplementation(() => updateChain());
  mockSelect.mockReset().mockImplementation((cols?: string) => {
    type Chain = {
      eq: (col: string, val: unknown) => Chain;
      gte: (col: string, val: unknown) => Chain;
      maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
    };
    const isDuplicateCheck = cols === "id";
    const chain: Chain = {
      eq: vi.fn(() => chain),
      gte: vi.fn(() => chain),
      maybeSingle: vi.fn().mockResolvedValue({
        data: isDuplicateCheck
          ? null
          : {
              id: "mock-id",
              created_at: "2026-10-27T01:30:00Z",
              name: "Asha Roy",
              phone: "+919147718046",
              email: "asha@example.com",
              preferred_date: "2026-11-05",
              preferred_time: "Evening",
              message: "Routine dental checkup",
              source: "Google search",
              status: "new",
            },
        error: null,
      }),
    };
    return chain;
  });

  sendEmail.mockReset().mockResolvedValue(undefined);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-26T20:00:00Z")); // 27 Oct 01:30 IST
});

afterEach(() => {
  if (originalServiceRoleKey !== undefined) {
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = originalServiceRoleKey;
  } else {
    delete process.env["SUPABASE_SERVICE_ROLE_KEY"];
  }
  vi.useRealTimers();
});

describe("handleCreateAppointment (server-side booking flow)", () => {
  it("successfully validates, persists atomically to database, and triggers notification email", async () => {
    const res = await handleCreateAppointment(postRequest(validBody));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; data: { saved: boolean; id: string } };
    expect(json.ok).toBe(true);
    expect(json.data.saved).toBe(true);
    expect(typeof json.data.id).toBe("string");
    expect(json.data.id.length).toBeGreaterThan(0);

    // Verify atomic RPC was called with normalized phone and fields
    expect(mockRpc).toHaveBeenCalledWith(
      "create_appointment_with_outbox",
      expect.objectContaining({
        p_name: "Asha Roy",
        p_phone: "+919147718046",
        p_email: "asha@example.com",
        p_preferred_date: "2026-11-05",
        p_preferred_time: "Evening",
        p_message: "Routine dental checkup",
        p_source: "Google search",
        p_treatment: "Not specified",
      }),
    );

    // Sequential fallback is strictly removed: insert is never called directly
    expect(mockInsert).not.toHaveBeenCalled();

    // Verify notification email was sent
    expect(sendEmail).toHaveBeenCalledOnce();
    const sent = sendEmail.mock.calls[0]?.[0] as { subject: string; html: string };
    expect(sent.subject).toContain("Asha Roy");
    expect(sent.html).toContain("+919147718046");
  });

  it("records consent with the server's clock and the current privacy policy version", async () => {
    await handleCreateAppointment(postRequest(validBody));

    expect(mockRpc).toHaveBeenCalledWith(
      "create_appointment_with_outbox",
      expect.objectContaining({
        p_privacy_consent_at: "2026-10-26T20:00:00.000Z", // the faked "now"
        p_privacy_policy_version: PRIVACY_POLICY_VERSION,
      }),
    );
  });

  it("ignores a consent time or policy version sent by the browser", async () => {
    await handleCreateAppointment(
      postRequest({
        ...validBody,
        privacy_consent_at: "2000-01-01T00:00:00.000Z",
        privacy_policy_version: "made-up",
      }),
    );

    expect(mockRpc).toHaveBeenCalledWith(
      "create_appointment_with_outbox",
      expect.objectContaining({
        p_privacy_consent_at: "2026-10-26T20:00:00.000Z",
        p_privacy_policy_version: PRIVACY_POLICY_VERSION,
      }),
    );
  });

  it("does not send the email itself when the retry worker already owns the outbox job", async () => {
    mockUpdate.mockImplementation(() => updateChain([]));

    const res = await handleCreateAppointment(postRequest(validBody));

    // The booking is still saved and reported as successful to the patient...
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; data: { saved: boolean } };
    expect(json.data.saved).toBe(true);
    // ...but only the worker that won the claim sends, so the clinic never gets two emails.
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("normalizes phone numbers and handles optional fields as null in atomic RPC call", async () => {
    const res = await handleCreateAppointment(
      postRequest({
        name: "Debayan Saha",
        phone: "+91 91477-18046",
        preferred_date: "2026-11-10",
        preferred_time: "Morning",
        privacy_consent: true,
      }),
    );
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      "create_appointment_with_outbox",
      expect.objectContaining({
        p_name: "Debayan Saha",
        p_phone: "+919147718046",
        p_email: null,
        p_message: null,
        p_source: null,
      }),
    );
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("silently drops bot submissions when honeypot field is filled", async () => {
    const res = await handleCreateAppointment(
      postRequest({
        ...validBody,
        website: "https://spam-bot.site",
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.saved).toBe(true);

    // No DB insert or email should occur
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("accepts appointment for today in clinic time even when UTC is yesterday", async () => {
    const res = await handleCreateAppointment(
      postRequest({
        ...validBody,
        preferred_date: "2026-10-27",
      }),
    );
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledOnce();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it.each([
    ["a past date", { preferred_date: "2026-10-26" }],
    ["an invalid calendar date", { preferred_date: "2026-02-30" }],
    ["an invalid phone", { phone: "123" }],
    ["an unsupported time slot", { preferred_time: "Midnight" }],
    ["a missing name", { name: "" }],
    ["an overlong message", { message: "x".repeat(1001) }],
    ["a missing privacy consent", { privacy_consent: undefined }],
    ["a false privacy consent", { privacy_consent: false }],
  ])("rejects %s with 400 validation error", async (_label, override) => {
    await expect(
      handleCreateAppointment(postRequest({ ...validBody, ...override })),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      status: 400,
    });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("fails safely with 500 when atomic booking RPC fails (no sequential fallback allowed)", async () => {
    mockRpc.mockResolvedValueOnce({
      error: { code: "42883", message: "function create_appointment_with_outbox does not exist" },
    });

    await expect(handleCreateAppointment(postRequest(validBody))).rejects.toMatchObject({
      code: "SERVER",
      status: 500,
      userMessage: "Something went wrong. Please call us instead.",
    });

    // CRITICAL: Ensure sequential fallback was NOT executed
    expect(mockInsert).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("never writes appointments or outbox rows outside the atomic RPC", async () => {
    await handleCreateAppointment(postRequest(validBody));

    expect(mockRpc).toHaveBeenCalledWith(
      "create_appointment_with_outbox",
      expect.objectContaining({ p_phone: "+919147718046", p_preferred_time: "Evening" }),
    );
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("fails safely with 500 when the booking RPC throws", async () => {
    mockRpc.mockRejectedValueOnce(new Error("connection reset"));

    await expect(handleCreateAppointment(postRequest(validBody))).rejects.toThrow();

    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("fails safely with 500 and writes nothing when the database client has no rpc support", async () => {
    vi.resetModules();
    vi.doMock("@/integrations/supabase/client.server", () => ({
      supabaseAdmin: { from: (table: string) => mockFrom(table) },
    }));

    try {
      const { handleCreateAppointment: handleWithoutRpc } =
        await import("./create-appointment.server");

      await expect(handleWithoutRpc(postRequest(validBody))).rejects.toMatchObject({
        code: "SERVER",
        status: 500,
      });

      expect(mockInsert).not.toHaveBeenCalled();
      expect(mockUpsert).not.toHaveBeenCalled();
      expect(sendEmail).not.toHaveBeenCalled();
    } finally {
      vi.doMock("@/integrations/supabase/client.server", () => ({
        supabaseAdmin: {
          from: (table: string) => mockFrom(table),
          rpc: (name: string, args: unknown) => mockRpc(name, args),
        },
      }));
      vi.resetModules();
    }
  });

  it("resiliently succeeds if notification email fails after atomic DB booking succeeds", async () => {
    sendEmail.mockRejectedValueOnce(new AppError("UPSTREAM", "Resend API connection failed"));

    const res = await handleCreateAppointment(postRequest(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.saved).toBe(true);
    expect(mockRpc).toHaveBeenCalledOnce();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("fails safely with 500 CONFIG error when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    delete process.env["SUPABASE_SERVICE_ROLE_KEY"];

    await expect(handleCreateAppointment(postRequest(validBody))).rejects.toMatchObject({
      code: "CONFIG",
      status: 500,
      userMessage: "Something went wrong. Please call us instead.",
    });

    expect(mockInsert).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("fails safely with 500 CONFIG error when SUPABASE_SERVICE_ROLE_KEY is empty or whitespace", async () => {
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "   ";

    await expect(handleCreateAppointment(postRequest(validBody))).rejects.toMatchObject({
      code: "CONFIG",
      status: 500,
      userMessage: "Something went wrong. Please call us instead.",
    });

    expect(mockInsert).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("detects and suppresses duplicate submission atomically via RPC returning existing appointment ID", async () => {
    mockRpc.mockResolvedValueOnce({
      data: "existing-appointment-uuid-999",
      error: null,
    });

    const res = await handleCreateAppointment(postRequest(validBody));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      data: { saved: boolean; id: string; duplicate: boolean };
    };
    expect(json.ok).toBe(true);
    expect(json.data.saved).toBe(true);
    expect(json.data.id).toBe("existing-appointment-uuid-999");
    expect(json.data.duplicate).toBe(true);

    // Initial email dispatch is skipped for duplicate submission
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("fails closed in production if TURNSTILE_SECRET_KEY is missing", async () => {
    const originalEnv = process.env["NODE_ENV"];
    const originalSecret = process.env["TURNSTILE_SECRET_KEY"];
    process.env["NODE_ENV"] = "production";
    delete process.env["TURNSTILE_SECRET_KEY"];

    try {
      await expect(handleCreateAppointment(postRequest(validBody))).rejects.toMatchObject({
        code: "CONFIG",
        status: 500,
        userMessage: expect.stringContaining(
          "Security verification service is temporarily unavailable",
        ),
      });
    } finally {
      process.env["NODE_ENV"] = originalEnv;
      if (originalSecret !== undefined) {
        process.env["TURNSTILE_SECRET_KEY"] = originalSecret;
      }
    }
  });

  it("handles Turnstile token verification with remote client IP when TURNSTILE_SECRET_KEY is configured", async () => {
    const originalTurnstile = process.env["TURNSTILE_SECRET_KEY"];
    process.env["TURNSTILE_SECRET_KEY"] = "mock-turnstile-secret";

    try {
      const req = new Request("http://test/api/create-appointment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "103.21.244.2",
        },
        body: JSON.stringify({
          ...validBody,
          turnstile_token: "1x00000000000000000000AA", // Passing test token
        }),
      });

      const res = await handleCreateAppointment(req);
      expect(res.status).toBe(200);
    } finally {
      if (originalTurnstile !== undefined) {
        process.env["TURNSTILE_SECRET_KEY"] = originalTurnstile;
      } else {
        delete process.env["TURNSTILE_SECRET_KEY"];
      }
    }
  });
});
