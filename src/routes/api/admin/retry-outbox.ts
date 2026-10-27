import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/admin/retry-outbox
 *
 * Manually trigger retry processing for pending/failed notification jobs.
 *
 * Security: Strictly protected by Supabase Auth staff session verification.
 */
export const Route = createFileRoute("/api/admin/retry-outbox")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const [{ withApiHandler }, { handleRetryOutbox }] = await Promise.all([
          import("@/server/http/with-api-handler"),
          import("@/features/admin/server/admin-appointments.server"),
        ]);
        return withApiHandler("admin-retry-outbox", handleRetryOutbox)(request);
      },
    },
  },
});
