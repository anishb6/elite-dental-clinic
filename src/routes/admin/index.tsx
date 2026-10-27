import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminApiError } from "@/features/admin/api/admin.api";
import { AppointmentsTable } from "@/features/admin/components/appointments-table";
import { NoteDialog } from "@/features/admin/components/note-dialog";
import { useAdminAppointments } from "@/features/admin/hooks/use-admin-appointments";
import { useAdminSession } from "@/features/admin/hooks/use-admin-session";
import { STATUS_FILTERS, type AppointmentRecord, type StatusFilter } from "@/features/admin/types";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Staff Appointment Dashboard | Elite Dental Clinic" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminDashboardPage,
});

function errorStatus(error: unknown): number | null {
  return error instanceof AdminApiError ? error.status : null;
}

function AdminDashboardPage() {
  const navigate = useNavigate();
  const { session, signOut } = useAdminSession();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim(), 300);
  const [note, setNote] = useState<AppointmentRecord | null>(null);
  const [dismissedRetry, setDismissedRetry] = useState(false);

  const { list, changeStatus, processOutbox } = useAdminAppointments({
    token: session?.token ?? null,
    page,
    status: statusFilter,
    search,
  });

  // An expired or invalid session sends staff back to the login page.
  const listError = list.error;
  useEffect(() => {
    if (errorStatus(listError) === 401) void navigate({ to: "/admin/login" });
  }, [listError, navigate]);

  const data = list.data;
  const appointments = data?.appointments ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, data?.totalPages ?? 1);
  const isLoading = !session || (list.isPending && !data);
  const forbidden = errorStatus(listError) === 403;

  function chooseFilter(next: StatusFilter) {
    setStatusFilter(next);
    setPage(1);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-xl font-bold text-foreground">Elite Dental Clinic</h1>
              <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                Staff Portal
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Logged in as {session?.email ?? "…"}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setDismissedRetry(false);
                processOutbox.mutate();
              }}
              disabled={processOutbox.isPending || !session || forbidden}
              className="inline-flex items-center gap-1.5 rounded border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              {processOutbox.isPending ? (
                "Processing Retries…"
              ) : (
                <>
                  <span aria-hidden="true">🔄</span> Process Notification Outbox
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {processOutbox.isSuccess && !dismissedRetry && (
          <div
            role="status"
            className="mb-6 flex items-center justify-between rounded bg-primary/10 p-3 text-sm text-primary"
          >
            <span>
              {processOutbox.data.processed === 0
                ? "Retry complete: no pending jobs."
                : `Retry complete: ${processOutbox.data.processed} processed (${processOutbox.data.succeeded} delivered, ${processOutbox.data.failed} failed).`}
            </span>
            <button
              type="button"
              onClick={() => setDismissedRetry(true)}
              className="text-xs font-bold hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {processOutbox.isError && (
          <p role="alert" className="mb-6 rounded bg-destructive/10 p-3 text-sm text-destructive">
            Could not process the outbox: {processOutbox.error.message}
          </p>
        )}

        {changeStatus.isError && (
          <p role="alert" className="mb-6 rounded bg-destructive/10 p-3 text-sm text-destructive">
            Could not update that appointment&apos;s status: {changeStatus.error.message}
          </p>
        )}

        {forbidden ? (
          <div role="alert" className="rounded-lg border border-border bg-card p-8 text-center">
            <h2 className="font-serif text-lg font-bold">No staff access</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {session?.email ?? "This account"} is signed in but isn&apos;t authorised as clinic
              staff. Sign out and use a staff account.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
                {STATUS_FILTERS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={statusFilter === tab.id}
                    onClick={() => chooseFilter(tab.id)}
                    className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                      statusFilter === tab.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div>
                <label htmlFor="admin-search" className="sr-only">
                  Search by patient name or phone
                </label>
                <input
                  id="admin-search"
                  type="search"
                  placeholder="Search patient or phone…"
                  value={searchInput}
                  onChange={(event) => {
                    setSearchInput(event.target.value);
                    setPage(1);
                  }}
                  className="w-64 rounded border border-input bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {list.isError && errorStatus(listError) !== 401 && (
              <div
                role="alert"
                className="mb-6 flex items-center justify-between rounded bg-destructive/10 p-3 text-sm text-destructive"
              >
                <span>
                  Could not load appointments:{" "}
                  {list.error instanceof Error ? list.error.message : String(list.error)}
                </span>
                <button
                  type="button"
                  onClick={() => void list.refetch()}
                  className="text-xs font-bold hover:underline"
                >
                  Try again
                </button>
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
              <AppointmentsTable
                appointments={appointments}
                isLoading={isLoading}
                updatingId={changeStatus.isPending ? (changeStatus.variables?.id ?? null) : null}
                onStatusChange={(id, status) => changeStatus.mutate({ id, status })}
                onViewNote={setNote}
              />

              <nav
                aria-label="Pagination"
                className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground"
              >
                <div aria-live="polite">
                  Showing {appointments.length} of {totalCount} total bookings
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1 || list.isFetching}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages || list.isFetching}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="rounded border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </nav>
            </div>
          </>
        )}
      </main>

      {note && note.message && (
        <NoteDialog patientName={note.name} message={note.message} onClose={() => setNote(null)} />
      )}
    </div>
  );
}
