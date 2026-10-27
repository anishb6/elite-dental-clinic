import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/notify-appointment
 *
 * Kept for compatibility but now protected by an internal shared secret.
 * New bookings go through POST /api/create-appointment instead, which
 * validates, stores, and emails atomically without calling this endpoint.
 *
 * External callers must supply `X-Notify-Secret: <NOTIFY_SECRET env value>`.
 * Without it the request is rejected with 401.
 *
 * All logic lives in `features/appointments/server` so secrets stay out of
 * the client bundle.
 */
export const Route = createFileRoute("/api/notify-appointment")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const [{ withApiHandler }, { handleNotifyAppointment }, { rateLimit }] = await Promise.all([
          import("@/server/http/with-api-handler"),
          import("@/features/appointments/server/notify-appointment.server"),
          import("@/server/http/rate-limit"),
        ]);
        return withApiHandler("notify-appointment", async (req) => {
          rateLimit(req, { windowMs: 60_000, max: 10, key: "notify-appointment" });
          return handleNotifyAppointment(req);
        })(request);
      },
    },
  },
});
