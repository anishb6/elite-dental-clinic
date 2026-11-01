import { useMemo, useReducer } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { AppointmentRecord, StatusFilter } from "../types";

/**
 * UI state for the staff dashboard (what the user is looking at), kept apart from server state
 * (the appointment list), which lives in TanStack Query via `useAdminAppointments`.
 *
 * It's a reducer so the "changing a filter or the search resets to page 1" rule exists in exactly
 * one place and is unit-testable without rendering anything.
 */
export type DashboardState = {
  page: number;
  status: StatusFilter;
  searchInput: string;
  /** Appointment whose note dialog is open. */
  note: AppointmentRecord | null;
  retryNoticeDismissed: boolean;
};

export type DashboardAction =
  | { type: "status-selected"; status: StatusFilter }
  | { type: "search-changed"; value: string }
  | { type: "page-changed"; page: number }
  | { type: "note-opened"; appointment: AppointmentRecord }
  | { type: "note-closed" }
  | { type: "retry-notice-dismissed" }
  | { type: "retry-started" };

export const initialDashboardState: DashboardState = {
  page: 1,
  status: "all",
  searchInput: "",
  note: null,
  retryNoticeDismissed: false,
};

export function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case "status-selected":
      return { ...state, status: action.status, page: 1 };
    case "search-changed":
      return { ...state, searchInput: action.value, page: 1 };
    case "page-changed":
      return { ...state, page: Math.max(1, action.page) };
    case "note-opened":
      return { ...state, note: action.appointment };
    case "note-closed":
      return { ...state, note: null };
    case "retry-notice-dismissed":
      return { ...state, retryNoticeDismissed: true };
    case "retry-started":
      return { ...state, retryNoticeDismissed: false };
  }
}

const SEARCH_DEBOUNCE_MS = 300;

export function useAdminDashboardState() {
  const [state, dispatch] = useReducer(dashboardReducer, initialDashboardState);
  // The query only sees the debounced term, so typing doesn't fire a request per keystroke.
  const search = useDebouncedValue(state.searchInput.trim(), SEARCH_DEBOUNCE_MS);

  const actions = useMemo(
    () => ({
      selectStatus: (status: StatusFilter) => dispatch({ type: "status-selected", status }),
      changeSearch: (value: string) => dispatch({ type: "search-changed", value }),
      goToPage: (page: number) => dispatch({ type: "page-changed", page }),
      openNote: (appointment: AppointmentRecord) => dispatch({ type: "note-opened", appointment }),
      closeNote: () => dispatch({ type: "note-closed" }),
      dismissRetryNotice: () => dispatch({ type: "retry-notice-dismissed" }),
      startRetry: () => dispatch({ type: "retry-started" }),
    }),
    [],
  );

  return { state, search, actions };
}
