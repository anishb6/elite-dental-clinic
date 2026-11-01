/**
 * Registry of this app's own HTTP endpoints (`src/routes/api/**`).
 *
 * Browser code must reference endpoints through these constants instead of repeating string
 * literals, so a path change is a one-line edit and `docs/API.md` has a single source to mirror.
 */

/** Public: create a booking (validated, rate limited, bot-checked). */
export const CREATE_APPOINTMENT_ENDPOINT = "/api/create-appointment";

/** Staff only (Bearer token): list appointments (GET) or change one's status (PATCH). */
export const ADMIN_APPOINTMENTS_ENDPOINT = "/api/admin/appointments";

/** Staff only (Bearer token): drain the notification outbox now (POST). */
export const ADMIN_RETRY_OUTBOX_ENDPOINT = "/api/admin/retry-outbox";
