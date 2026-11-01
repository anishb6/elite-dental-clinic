import { describe, expect, it } from "vitest";
import {
  dashboardReducer,
  initialDashboardState,
  type DashboardState,
} from "./use-admin-dashboard-state";
import type { AppointmentRecord } from "../types";

const onPageThree: DashboardState = { ...initialDashboardState, page: 3 };

describe("dashboardReducer", () => {
  it("returns to page 1 when the status filter changes", () => {
    expect(dashboardReducer(onPageThree, { type: "status-selected", status: "new" })).toMatchObject(
      { status: "new", page: 1 },
    );
  });

  it("returns to page 1 when the search text changes", () => {
    expect(dashboardReducer(onPageThree, { type: "search-changed", value: "asha" })).toMatchObject({
      searchInput: "asha",
      page: 1,
    });
  });

  it("never goes below page 1", () => {
    expect(dashboardReducer(onPageThree, { type: "page-changed", page: 0 }).page).toBe(1);
    expect(dashboardReducer(onPageThree, { type: "page-changed", page: 4 }).page).toBe(4);
  });

  it("opens and closes the note dialog", () => {
    const appointment = { id: "a", name: "Asha", message: "Sensitive tooth" } as AppointmentRecord;
    const opened = dashboardReducer(initialDashboardState, { type: "note-opened", appointment });
    expect(opened.note).toBe(appointment);
    expect(dashboardReducer(opened, { type: "note-closed" }).note).toBeNull();
  });

  it("shows the retry notice again after a new retry starts", () => {
    const dismissed = dashboardReducer(initialDashboardState, { type: "retry-notice-dismissed" });
    expect(dismissed.retryNoticeDismissed).toBe(true);
    expect(dashboardReducer(dismissed, { type: "retry-started" }).retryNoticeDismissed).toBe(false);
  });
});
