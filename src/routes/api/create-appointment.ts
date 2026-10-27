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
        const [{ withApiHandler }, { handleCreateAppointment }, { rateLimitShared }] =
          await Promise.all([
            import("@/server/http/with-api-handler"),
            import("@/features/appointments/server/create-appointment.server"),
            import("@/server/http/rate-limit"),
          ]);
        return withApiHandler("create-appointment", async (req) => {
          let supabase = null;
          if (process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
            try {
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              supabase = supabaseAdmin;
            } catch {
              // fallback gracefully to in-memory
            }
          }
          await rateLimitShared(supabase, req, {
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
