/** Shared types and option lists for the staff portal. */

export const STATUS_OPTIONS = [
  { value: "new", label: "New Request" },
  { value: "called", label: "Patient Called" },
  { value: "confirmed", label: "Confirmed" },
  { value: "visited", label: "Visited" },
  { value: "completed", label: "Completed" },
  { value: "no_show", label: "No Show" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export type AppointmentStatus = (typeof STATUS_OPTIONS)[number]["value"];

export const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "called", label: "Called" },
  { id: "confirmed", label: "Confirmed" },
  { id: "visited", label: "Visited" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
] as const;

export type StatusFilter = (typeof STATUS_FILTERS)[number]["id"];

export type NotificationSummary = {
  status: string;
  attempts: number;
  last_error: string | null;
};

export type AppointmentRecord = {
  id: string;
  created_at: string;
  name: string;
  phone: string;
  email: string | null;
  preferred_date: string;
  preferred_time: string;
  message: string | null;
  source: string | null;
  status: string;
  treatment: string;
  notification: NotificationSummary;
};

export type AppointmentPage = {
  appointments: AppointmentRecord[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type RetryOutboxResult = { processed: number; succeeded: number; failed: number };
