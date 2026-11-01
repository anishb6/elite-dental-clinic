import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getErrorStatus } from "@/lib/errors";
import { fetchAppointments, retryOutbox, updateAppointmentStatus } from "../api/admin.api";
import type { AppointmentPage, AppointmentStatus, StatusFilter } from "../types";

const PAGE_SIZE = 15;

type Options = { token: string | null; page: number; status: StatusFilter; search: string };

/** Auth failures won't fix themselves on retry; everything else gets one more try. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  const status = getErrorStatus(error);
  if (status === 401 || status === 403) return false;
  return failureCount < 1;
}

/**
 * Server state for the staff dashboard: the paginated list plus the two write actions.
 * The session token is deliberately NOT part of the query key, so a silent token refresh doesn't
 * throw away the cached page and refetch.
 */
export function useAdminAppointments({ token, page, status, search }: Options) {
  const queryClient = useQueryClient();
  const listKey = ["admin", "appointments", { page, status, search }] as const;

  const list = useQuery({
    queryKey: listKey,
    queryFn: () => fetchAppointments(token!, { page, pageSize: PAGE_SIZE, status, search }),
    enabled: Boolean(token),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    retry: shouldRetry,
  });

  const changeStatus = useMutation({
    mutationFn: (vars: { id: string; status: AppointmentStatus }) =>
      updateAppointmentStatus(token!, vars.id, vars.status),
    onSuccess: (_result, vars) => {
      // Patch every cached page so the row doesn't flicker back, then let the next fetch confirm.
      queryClient.setQueriesData<AppointmentPage>(
        { queryKey: ["admin", "appointments"] },
        (cached) =>
          cached && {
            ...cached,
            appointments: cached.appointments.map((row) =>
              row.id === vars.id ? { ...row, status: vars.status } : row,
            ),
          },
      );
    },
  });

  const processOutbox = useMutation({
    mutationFn: () => retryOutbox(token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "appointments"] }),
  });

  return { list, changeStatus, processOutbox };
}
