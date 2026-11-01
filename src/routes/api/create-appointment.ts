import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/create-appointment
 *
 * Secure server-side appointment creation: validates user input, persists
 * the record in Supabase, and dispatches the clinic notification email.
 */
export const Route = createFileRoute("/api/create-appointment")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const [
          { withApiHandler },
          { handleCreateAppointment },
          { rateLimitShared },
          { tryGetAdminClient },
        ] = await Promise.all([
          import("@/server/http/with-api-handler"),
          import("@/features/appointments/server/create-appointment.server"),
          import("@/server/http/rate-limit"),
          import("@/server/services/database.server"),
        ]);
        return withApiHandler("create-appointment", async (req) => {
          // Shared (database-backed) limiter when available; the in-memory limiter otherwise.
          await rateLimitShared(await tryGetAdminClient(), req, {
            windowMs: 60_000,
            max: 10,
            key: "create-appointment",
          });
          return handleCreateAppointment(req);
        })(request);
      },
    },
  },
});
