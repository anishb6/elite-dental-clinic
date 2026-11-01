import { beforeEach, describe, expect, it, vi } from "vitest";

const processNotificationOutbox = vi.fn();
const getAdminClient = vi.fn();

vi.mock("./notification-outbox.server", () => ({
  processNotificationOutbox: (...args: unknown[]) => processNotificationOutbox(...args),
}));
vi.mock("@/server/services/database.server", () => ({
  getAdminClient: (...args: unknown[]) => getAdminClient(...args),
}));

import { retryPendingNotifications } from "./retry-notifications.server";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("retryPendingNotifications", () => {
  it("processes one batch of 25 with the trusted database client", async () => {
    const client = { marker: "admin" };
    getAdminClient.mockResolvedValue(client);
    processNotificationOutbox.mockResolvedValue({ processed: 2, succeeded: 1, failed: 1 });

    await expect(retryPendingNotifications()).resolves.toEqual({
      processed: 2,
      succeeded: 1,
      failed: 1,
    });
    expect(processNotificationOutbox).toHaveBeenCalledWith(client, 25);
  });

  it("propagates a configuration error so the scheduler run is marked failed", async () => {
    getAdminClient.mockRejectedValue(new Error("not configured"));
    await expect(retryPendingNotifications()).rejects.toThrow("not configured");
    expect(processNotificationOutbox).not.toHaveBeenCalled();
  });
});
