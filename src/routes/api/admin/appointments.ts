import { createFileRoute } from "@tanstack/react-router";

/**
 * /api/admin/appointments
 *
 * GET: List paginated appointments with search, filter, and outbox delivery status.
 * PATCH: Update appointment status (new, called, confirmed, visited, completed, etc.).
 *
 * Security: Strictly protected by Supabase Auth staff session verification.
 */
export const Route = createFileRoute("/api/admin/appointments")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const [{ withApiHandler }, { handleListAdminAppointments }] = await Promise.all([
          import("@/server/http/with-api-handler"),
          import("@/features/admin/server/admin-appointments.server"),
        ]);
        return withApiHandler("admin-appointments-list", handleListAdminAppointments)(request);
      },
      PATCH: async ({ request }) => {
        const [{ withApiHandler }, { handleUpdateAdminAppointmentStatus }] = await Promise.all([
          import("@/server/http/with-api-handler"),
          import("@/features/admin/server/admin-appointments.server"),
        ]);
        return withApiHandler(
          "admin-appointments-update",
          handleUpdateAdminAppointmentStatus,
        )(request);
      },
    },
  },
});
