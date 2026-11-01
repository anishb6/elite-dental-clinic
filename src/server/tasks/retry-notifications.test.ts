import { beforeEach, describe, expect, it, vi } from "vitest";

const retryPendingNotifications = vi.fn();

vi.mock("nitro/task", () => ({ defineTask: <T>(definition: T) => definition }));
vi.mock("../../features/appointments/server/retry-notifications.server", () => ({
  retryPendingNotifications: () => retryPendingNotifications(),
}));

import task from "./retry-notifications";

const runTask = () => (task as unknown as { run: () => Promise<unknown> }).run();

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("notifications:retry scheduled task", () => {
  it("returns the batch result", async () => {
    retryPendingNotifications.mockResolvedValue({ processed: 0, succeeded: 0, failed: 0 });
    await expect(runTask()).resolves.toEqual({
      result: { processed: 0, succeeded: 0, failed: 0 },
    });
  });

  it("rethrows failures so Cloudflare records the run as failed", async () => {
    retryPendingNotifications.mockRejectedValue(new Error("database down"));
    await expect(runTask()).rejects.toThrow("database down");
  });
});
