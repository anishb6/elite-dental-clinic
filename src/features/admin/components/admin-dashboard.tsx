import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { getErrorStatus, getUserMessage } from "@/lib/errors";
import { useAdminAppointments } from "../hooks/use-admin-appointments";
import { useAdminDashboardState } from "../hooks/use-admin-dashboard-state";
import { useAdminSession } from "../hooks/use-admin-session";
import { AdminHeader } from "./admin-header";
import { AlertBanner } from "./alert-banner";
import { AppointmentSearch } from "./appointment-search";
import { AppointmentsTable } from "./appointments-table";
import { NoteDialog } from "./note-dialog";
import { PaginationBar } from "./pagination-bar";
import { StatusFilterTabs } from "./status-filter-tabs";

/** Staff portal page: wires session, UI state and server state to the presentational parts. */
export function AdminDashboard() {
  const navigate = useNavigate();
  const { session, signOut } = useAdminSession();
  const { state, search, actions } = useAdminDashboardState();

  const { list, changeStatus, processOutbox } = useAdminAppointments({
    token: session?.token ?? null,
    page: state.page,
    status: state.status,
    search,
  });

  // An expired or invalid session sends staff back to the login page.
  const listStatus = getErrorStatus(list.error);
  useEffect(() => {
    if (listStatus === 401) void navigate({ to: "/admin/login" });
  }, [listStatus, navigate]);

  const data = list.data;
  const appointments = data?.appointments ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, data?.totalPages ?? 1);
  const isLoading = !session || (list.isPending && !data);
  const forbidden = listStatus === 403;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdminHeader
        email={session?.email}
        outboxDisabled={!session || forbidden}
        isProcessingOutbox={processOutbox.isPending}
        onProcessOutbox={() => {
          actions.startRetry();
          processOutbox.mutate();
        }}
        onSignOut={() => void signOut()}
      />

      <main className="mx-auto max-w-7xl px-6 py-8">
        {processOutbox.isSuccess && !state.retryNoticeDismissed && (
          <AlertBanner
            tone="success"
            action={{ label: "Dismiss", onClick: actions.dismissRetryNotice }}
          >
            {processOutbox.data.processed === 0
              ? "Retry complete: no pending jobs."
              : `Retry complete: ${processOutbox.data.processed} processed (${processOutbox.data.succeeded} delivered, ${processOutbox.data.failed} failed).`}
          </AlertBanner>
        )}

        {processOutbox.isError && (
          <AlertBanner tone="error">
            Could not process the outbox: {getUserMessage(processOutbox.error)}
          </AlertBanner>
        )}

        {changeStatus.isError && (
          <AlertBanner tone="error">
            Could not update that appointment&apos;s status: {getUserMessage(changeStatus.error)}
          </AlertBanner>
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
              <StatusFilterTabs value={state.status} onChange={actions.selectStatus} />
              <AppointmentSearch value={state.searchInput} onChange={actions.changeSearch} />
            </div>

            {list.isError && listStatus !== 401 && (
              <AlertBanner
                tone="error"
                action={{ label: "Try again", onClick: () => void list.refetch() }}
              >
                Could not load appointments: {getUserMessage(list.error)}
              </AlertBanner>
            )}

            <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
              <AppointmentsTable
                appointments={appointments}
                isLoading={isLoading}
                updatingId={changeStatus.isPending ? (changeStatus.variables?.id ?? null) : null}
                onStatusChange={(id, status) => changeStatus.mutate({ id, status })}
                onViewNote={actions.openNote}
              />
              <PaginationBar
                page={state.page}
                totalPages={totalPages}
                shown={appointments.length}
                totalCount={totalCount}
                busy={list.isFetching}
                onPageChange={actions.goToPage}
              />
            </div>
          </>
        )}
      </main>

      {state.note?.message && (
        <NoteDialog
          patientName={state.note.name}
          message={state.note.message}
          onClose={actions.closeNote}
        />
      )}
    </div>
  );
}
