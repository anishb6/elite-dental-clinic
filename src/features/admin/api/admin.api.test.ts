import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AdminApiError,
  fetchAppointments,
  retryOutbox,
  updateAppointmentStatus,
} from "./admin.api";

const fetchMock = vi.fn();

function respond(status: number, body: unknown) {
  fetchMock.mockResolvedValueOnce(
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status }),
  );
}

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function stub() {
  vi.stubGlobal("fetch", fetchMock);
}

describe("admin API client", () => {
  it("sends the bearer token and query params, and unwraps the data envelope", async () => {
    stub();
    const page = { appointments: [], totalCount: 0, page: 2, pageSize: 15, totalPages: 1 };
    respond(200, { ok: true, data: page });

    const result = await fetchAppointments("tok-1", {
      page: 2,
      pageSize: 15,
      status: "new",
      search: "asha",
    });

    expect(result).toEqual(page);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("/api/admin/appointments?page=2&pageSize=15&status=new&search=asha");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer tok-1");
  });

  it("surfaces 401 and 403 with their status so the UI can react differently", async () => {
    stub();
    respond(401, { ok: false, error: { code: "VALIDATION", message: "Session expired." } });
    await expect(
      fetchAppointments("t", { page: 1, pageSize: 15, status: "all", search: "" }),
    ).rejects.toMatchObject({ name: "AdminApiError", status: 401, message: "Session expired." });

    respond(403, { ok: false, error: { code: "VALIDATION", message: "Access forbidden." } });
    await expect(
      fetchAppointments("t", { page: 1, pageSize: 15, status: "all", search: "" }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("turns a network failure into a friendly error with status 0", async () => {
    stub();
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const error = await retryOutbox("t").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AdminApiError);
    expect((error as AdminApiError).status).toBe(0);
    expect((error as AdminApiError).message).toMatch(/network/i);
  });

  it("handles a non-JSON error body (e.g. a proxy error page)", async () => {
    stub();
    respond(502, "<html>Bad gateway</html>");
    await expect(retryOutbox("t")).rejects.toMatchObject({
      status: 502,
      message: "Request failed (HTTP 502).",
    });
  });

  it("PATCHes a JSON status update", async () => {
    stub();
    respond(200, { ok: true, data: { id: "a", status: "confirmed", updated: true } });
    await updateAppointmentStatus("t", "a", "confirmed");
    const [, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ id: "a", status: "confirmed" });
  });
});
