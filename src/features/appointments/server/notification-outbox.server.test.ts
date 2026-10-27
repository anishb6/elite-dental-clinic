import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { AppError } from "@/lib/errors";
import {
  calculateNextAttempt,
  claimAndDeliverNotification,
  claimOutboxJob,
  deliverNotification,
  enqueueNotification,
  processNotificationOutbox,
  sanitizeErrorMetadata,
} from "./notification-outbox.server";

const mockUpsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockRpc = vi.fn();
const mockFrom = vi.fn((_table?: string) => ({
  upsert: mockUpsert,
  update: mockUpdate,
  select: mockSelect,
}));

const mockSupabase = {
  from: mockFrom,
  rpc: (name: string, args: unknown) => mockRpc(name, args),
} as unknown as SupabaseClient<Database>;

const mockSendEmail = vi.fn();
vi.mock("@/server/services/email.server", () => ({
  sendEmail: (arg: unknown) => mockSendEmail(arg),
}));

describe("notification-outbox.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["RESEND_API_KEY"] = "re_test_key";
    process.env["NOTIFY_EMAIL"] = "clinic@example.com";
  });

  describe("calculateNextAttempt", () => {
    it("computes exponential backoff intervals correctly", () => {
      const now = new Date("2026-10-27T10:00:00Z");

      // Attempt 1: +2 minutes
      const attempt1 = calculateNextAttempt(1, now);
      expect(new Date(attempt1).getTime() - now.getTime()).toBe(2 * 60_000);

      // Attempt 2: +10 minutes
      const attempt2 = calculateNextAttempt(2, now);
      expect(new Date(attempt2).getTime() - now.getTime()).toBe(10 * 60_000);

      // Attempt 3: +30 minutes
      const attempt3 = calculateNextAttempt(3, now);
      expect(new Date(attempt3).getTime() - now.getTime()).toBe(30 * 60_000);

      // Attempt 4+: +120 minutes (2 hours)
      const attempt4 = calculateNextAttempt(4, now);
      expect(new Date(attempt4).getTime() - now.getTime()).toBe(120 * 60_000);
    });
  });

  describe("sanitizeErrorMetadata", () => {
    it("preserves technical error codes and redacts sensitive patient patterns", () => {
      const appErr = new AppError("UPSTREAM", "Resend rate limit exceeded 429");
      expect(sanitizeErrorMetadata(appErr)).toBe("UPSTREAM: Resend rate limit exceeded 429");

      const errWithPhone = new Error("Failed to send notification for patient +919147718046");
      expect(sanitizeErrorMetadata(errWithPhone)).toContain("[REDACTED]");
      expect(sanitizeErrorMetadata(errWithPhone)).not.toContain("9147718046");
    });
  });

  describe("enqueueNotification", () => {
    it("enqueues appointment into outbox with idempotency constraint", async () => {
      mockUpsert.mockReturnValue({
        select: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: "outbox-1" }, error: null }),
        })),
      });

      const res = await enqueueNotification(mockSupabase, "app-123");
      expect(res.enqueued).toBe(true);
      expect(res.id).toBe("outbox-1");
      expect(mockFrom).toHaveBeenCalledWith("notification_outbox");
    });
  });

  describe("deliverNotification", () => {
    it("skips delivery and returns success immediately if notification is already marked sent (idempotency guard)", async () => {
      mockFrom.mockImplementation((table?: string) => {
        if (table === "notification_outbox") {
          return {
            upsert: mockUpsert,
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { status: "sent", attempts: 1, max_attempts: 5 },
                  error: null,
                }),
              })),
            })),
            update: mockUpdate,
          };
        }
        return { upsert: mockUpsert, select: mockSelect, update: mockUpdate };
      });

      const result = await deliverNotification(mockSupabase, "app-already-sent");
      expect(result.success).toBe(true);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("marks outbox row as sent when Resend dispatch succeeds", async () => {
      const sampleAppointment = {
        id: "app-123",
        created_at: "2026-10-27T01:30:00Z",
        name: "Debayan Saha",
        phone: "+919147718046",
        email: "doc@example.com",
        preferred_date: "2026-11-10",
        preferred_time: "Morning",
        message: "Checkup",
        source: "Website",
        status: "new",
      };

      mockFrom.mockImplementation((table?: string) => {
        if (table === "notification_outbox") {
          return {
            upsert: mockUpsert,
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { status: "pending", attempts: 0, max_attempts: 5 },
                  error: null,
                }),
              })),
            })),
            update: mockUpdate.mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        }
        if (table === "appointments") {
          return {
            upsert: mockUpsert,
            update: mockUpdate,
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: sampleAppointment, error: null }),
              })),
            })),
          };
        }
        return { upsert: mockUpsert, select: mockSelect, update: mockUpdate };
      });

      mockSendEmail.mockResolvedValueOnce(undefined);

      const result = await deliverNotification(mockSupabase, "app-123");
      expect(result.success).toBe(true);
      expect(mockSendEmail).toHaveBeenCalledOnce();
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "sent",
        }),
      );
    });

    it("marks outbox row as failed and schedules next attempt when Resend dispatch fails", async () => {
      const sampleAppointment = {
        id: "app-123",
        created_at: "2026-10-27T01:30:00Z",
        name: "Debayan Saha",
        phone: "+919147718046",
        email: null,
        preferred_date: "2026-11-10",
        preferred_time: "Morning",
        message: null,
        source: null,
        status: "new",
      };

      mockFrom.mockImplementation((table?: string) => {
        if (table === "notification_outbox") {
          return {
            upsert: mockUpsert,
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { status: "pending", attempts: 0, max_attempts: 5 },
                  error: null,
                }),
              })),
            })),
            update: mockUpdate.mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        }
        if (table === "appointments") {
          return {
            upsert: mockUpsert,
            update: mockUpdate,
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: sampleAppointment, error: null }),
              })),
            })),
          };
        }
        return { upsert: mockUpsert, select: mockSelect, update: mockUpdate };
      });

      mockSendEmail.mockRejectedValueOnce(
        new AppError("UPSTREAM", "Resend API connection timed out"),
      );

      const result = await deliverNotification(mockSupabase, "app-123");
      expect(result.success).toBe(false);
      expect(result.error).toContain("UPSTREAM");
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "failed",
          attempts: 1,
        }),
      );
    });

    it("resiliently treats delivery as success if email was sent even if outbox status update returns an error", async () => {
      const sampleAppointment = {
        id: "app-123",
        created_at: "2026-10-27T01:30:00Z",
        name: "Debayan Saha",
        phone: "+919147718046",
        email: null,
        preferred_date: "2026-11-10",
        preferred_time: "Morning",
        message: null,
        source: null,
        status: "new",
      };

      mockFrom.mockImplementation((table?: string) => {
        if (table === "notification_outbox") {
          return {
            upsert: mockUpsert,
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { status: "pending", attempts: 0, max_attempts: 5 },
                  error: null,
                }),
              })),
            })),
            update: mockUpdate.mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: null,
                error: { code: "57P01", message: "terminating connection" },
              }),
            }),
          };
        }
        if (table === "appointments") {
          return {
            upsert: mockUpsert,
            update: mockUpdate,
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: sampleAppointment, error: null }),
              })),
            })),
          };
        }
        return { upsert: mockUpsert, select: mockSelect, update: mockUpdate };
      });

      mockSendEmail.mockResolvedValueOnce(undefined);

      const result = await deliverNotification(mockSupabase, "app-123");
      expect(result.success).toBe(true);
    });
  });

  describe("claimOutboxJob / claimAndDeliverNotification", () => {
    /** Builds `update().eq().in().lte().select()` resolving to `result`, recording the filters used. */
    function mockClaim(result: { data: unknown; error: unknown }) {
      const calls: Record<string, unknown[]> = {};
      const chain = {
        eq: vi.fn((...a: unknown[]) => ((calls["eq"] = a), chain)),
        in: vi.fn((...a: unknown[]) => ((calls["in"] = a), chain)),
        lte: vi.fn((...a: unknown[]) => ((calls["lte"] = a), chain)),
        select: vi.fn().mockResolvedValue(result),
      };
      mockUpdate.mockReturnValue(chain);
      mockFrom.mockImplementation(() => ({
        upsert: mockUpsert,
        update: mockUpdate,
        select: mockSelect,
      }));
      return calls;
    }

    it("claims only pending/failed jobs that are due, for the given appointment", async () => {
      const calls = mockClaim({ data: [{ id: "outbox-1" }], error: null });

      await expect(claimOutboxJob(mockSupabase, "app-123")).resolves.toBe(true);

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "processing" }));
      expect(calls["eq"]).toEqual(["appointment_id", "app-123"]);
      expect(calls["in"]).toEqual(["status", ["pending", "failed"]]);
      expect(calls["lte"]?.[0]).toBe("next_attempt_at");
    });

    it("reports not-claimed when another worker already took the job", async () => {
      mockClaim({ data: [], error: null });
      await expect(claimOutboxJob(mockSupabase, "app-123")).resolves.toBe(false);
    });

    it("reports not-claimed (rather than throwing) when the claim query errors", async () => {
      mockClaim({ data: null, error: { code: "08006" } });
      await expect(claimOutboxJob(mockSupabase, "app-123")).resolves.toBe(false);
    });

    it("skips sending entirely when the claim is lost", async () => {
      mockClaim({ data: [], error: null });
      const result = await claimAndDeliverNotification(mockSupabase, "app-123");
      expect(result).toEqual({ success: true, skipped: true });
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });

  describe("failure bookkeeping when email is not configured", () => {
    it("counts the attempt and backs off instead of leaving the job instantly re-claimable", async () => {
      delete process.env["RESEND_API_KEY"];
      mockFrom.mockImplementation((table?: string) => {
        if (table === "notification_outbox") {
          return {
            upsert: mockUpsert,
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { status: "processing", attempts: 0, max_attempts: 5 },
                  error: null,
                }),
              })),
            })),
            update: mockUpdate.mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        }
        return { upsert: mockUpsert, select: mockSelect, update: mockUpdate };
      });

      const before = Date.now();
      const result = await deliverNotification(mockSupabase, "app-123");

      expect(result.success).toBe(false);
      expect(mockSendEmail).not.toHaveBeenCalled();
      const payload = mockUpdate.mock.calls[0]![0] as {
        status: string;
        attempts: number;
        next_attempt_at: string;
      };
      expect(payload.status).toBe("failed");
      expect(payload.attempts).toBe(1);
      // First retry is pushed ~2 minutes out, not "now".
      expect(new Date(payload.next_attempt_at).getTime()).toBeGreaterThanOrEqual(
        before + 2 * 60_000 - 1000,
      );
    });

    it("stops retrying once max attempts are used up", async () => {
      delete process.env["RESEND_API_KEY"];
      mockFrom.mockImplementation((table?: string) => ({
        upsert: mockUpsert,
        select:
          table === "notification_outbox"
            ? vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { status: "processing", attempts: 4, max_attempts: 5 },
                    error: null,
                  }),
                })),
              }))
            : mockSelect,
        update: mockUpdate.mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }));

      await deliverNotification(mockSupabase, "app-123");

      const payload = mockUpdate.mock.calls[0]![0] as { attempts: number; last_error: string };
      expect(payload.attempts).toBe(5);
      expect(payload.last_error).toMatch(/^EXHAUSTED/);
    });
  });

  describe("processNotificationOutbox", () => {
    it("processes claimed jobs atomically via claim_notification_outbox_jobs RPC", async () => {
      const claimedJobs = [
        { id: "outbox-1", appointment_id: "app-1", attempts: 0, max_attempts: 5 },
        { id: "outbox-2", appointment_id: "app-2", attempts: 1, max_attempts: 5 },
      ];

      mockRpc.mockResolvedValueOnce({ data: claimedJobs, error: null });

      const sampleApp = {
        id: "app-1",
        created_at: "2026-10-27T01:30:00Z",
        name: "Patient",
        phone: "+919147718046",
        email: null,
        preferred_date: "2026-11-10",
        preferred_time: "Morning",
        message: null,
        source: null,
        status: "new",
      };

      mockFrom.mockImplementation((table?: string) => {
        if (table === "appointments") {
          return {
            upsert: mockUpsert,
            update: mockUpdate,
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: sampleApp, error: null }),
              })),
            })),
          };
        }
        if (table === "notification_outbox") {
          return {
            upsert: mockUpsert,
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { status: "pending", attempts: 0, max_attempts: 5 },
                  error: null,
                }),
              })),
            })),
            update: mockUpdate.mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        }
        return { upsert: mockUpsert, select: mockSelect, update: mockUpdate };
      });

      mockSendEmail.mockResolvedValue(undefined);

      const result = await processNotificationOutbox(mockSupabase, 10);
      expect(mockRpc).toHaveBeenCalledWith("claim_notification_outbox_jobs", {
        p_batch_size: 10,
        p_stale_minutes: 10,
      });
      expect(result.processed).toBe(2);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);
    });

    it("fails safely and reports error without unsafe fallback when atomic claim RPC fails", async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { code: "42883", message: "function claim_notification_outbox_jobs does not exist" },
      });

      await expect(processNotificationOutbox(mockSupabase, 10)).rejects.toMatchObject({
        code: "SERVER",
        status: 500,
        message: expect.stringContaining("Failed to claim outbox notification jobs from database"),
      });

      // Email should NOT be sent if claiming fails
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("never touches the outbox table or sends email when the claim RPC fails", async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { code: "57014", message: "timeout" } });

      await expect(processNotificationOutbox(mockSupabase, 10)).rejects.toMatchObject({
        code: "SERVER",
        status: 500,
      });

      // No "select eligible rows and process them anyway" fallback.
      expect(mockFrom).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("refuses to process jobs when the database client has no rpc support", async () => {
      const noRpcClient = { from: mockFrom } as unknown as SupabaseClient<Database>;

      await expect(processNotificationOutbox(noRpcClient, 10)).rejects.toMatchObject({
        code: "SERVER",
        status: 500,
      });

      expect(mockFrom).not.toHaveBeenCalled();
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });
});
