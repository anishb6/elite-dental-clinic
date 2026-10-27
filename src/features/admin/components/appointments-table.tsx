import { STATUS_OPTIONS, type AppointmentRecord, type AppointmentStatus } from "../types";
import { NotificationBadge } from "./notification-badge";

type AppointmentsTableProps = {
  appointments: AppointmentRecord[];
  isLoading: boolean;
  /** Id of the row whose status change is in flight. */
  updatingId: string | null;
  onStatusChange: (id: string, status: AppointmentStatus) => void;
  onViewNote: (appointment: AppointmentRecord) => void;
};

const COLUMNS = [
  "Preferred Date & Slot",
  "Patient",
  "Phone",
  "Status",
  "Email Notification",
  "Notes",
  "Submitted",
];

function statusClasses(status: string): string {
  if (status === "new") {
    return "border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200";
  }
  if (status === "confirmed") {
    return "border-blue-400 bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200";
  }
  if (status === "completed" || status === "visited") {
    return "border-green-400 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200";
  }
  return "border-border bg-background text-foreground";
}

function formatSubmitted(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AppointmentsTable({
  appointments,
  isLoading,
  updatingId,
  onStatusChange,
  onViewNote,
}: AppointmentsTableProps) {
  return (
    <table className="w-full text-left text-sm" aria-busy={isLoading}>
      <caption className="sr-only">Appointment requests</caption>
      <thead className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase">
        <tr>
          {COLUMNS.map((label) => (
            <th key={label} scope="col" className="px-4 py-3">
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {isLoading ? (
          <tr>
            <td
              colSpan={COLUMNS.length}
              role="status"
              className="px-4 py-12 text-center text-muted-foreground"
            >
              Loading appointment requests…
            </td>
          </tr>
        ) : appointments.length === 0 ? (
          <tr>
            <td colSpan={COLUMNS.length} className="px-4 py-12 text-center text-muted-foreground">
              No appointments found matching this filter.
            </td>
          </tr>
        ) : (
          appointments.map((app) => (
            <tr key={app.id} className="hover:bg-muted/30">
              <th
                scope="row"
                className="px-4 py-3 whitespace-nowrap text-left font-medium text-foreground"
              >
                {app.preferred_date}
                <span className="block text-xs font-normal text-muted-foreground">
                  {app.preferred_time}
                </span>
              </th>
              <td className="px-4 py-3 font-medium text-foreground">
                {app.name}
                {app.email && (
                  <span className="block text-xs font-normal text-muted-foreground">
                    {app.email}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <a
                  href={`tel:${app.phone}`}
                  className="font-mono text-xs text-primary hover:underline"
                >
                  {app.phone}
                </a>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <select
                  aria-label={`Status for ${app.name}`}
                  value={app.status}
                  disabled={updatingId === app.id}
                  onChange={(event) =>
                    onStatusChange(app.id, event.target.value as AppointmentStatus)
                  }
                  className={`rounded border px-2 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-ring ${statusClasses(app.status)}`}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <NotificationBadge notification={app.notification} />
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {app.message ? (
                  <button
                    type="button"
                    onClick={() => onViewNote(app)}
                    aria-label={`View note from ${app.name}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    View Note
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">None</span>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                {formatSubmitted(app.created_at)}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
