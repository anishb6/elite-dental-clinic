/**
 * Server-side appointment management and authorization for the Staff Admin Dashboard.
 *
 * Security:
 * - Every handler strictly validates the Supabase Auth Bearer JWT using the server-only
 *   Supabase Admin client (`supabaseAdmin.auth.getUser(token)`).
 * - Public callers without a valid staff session are rejected with HTTP 401 Unauthorized.
 * - Service-role key is kept exclusively on the server and never returned to the client.
 */
import { z } from "zod";
import { getStaffAllowlist } from "@/config/env.server";
import { AppError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { parseJsonBody } from "@/server/http/parse-body";
import { jsonOk } from "@/server/http/responses";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { processNotificationOutbox } from "@/features/appointments/server/notification-outbox.server";

const logger = createLogger("admin-appointments");

const ALLOWED_STATUSES = [
  "new",
  "called",
  "confirmed",
  "visited",
  "completed",
  "no_show",
  "cancelled",
] as const;

export type AppointmentStatus = (typeof ALLOWED_STATUSES)[number];

const updateStatusSchema = z.object({
  id: z.string().uuid("Invalid appointment ID format (UUID expected)"),
  status: z.enum(ALLOWED_STATUSES, {
    errorMap: () => ({ message: `Invalid status. Supported: ${ALLOWED_STATUSES.join(", ")}` }),
  }),
});

/** Admin responses contain patient data: browsers and shared caches must never store them. */
const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

const SEARCH_MAX_LENGTH = 50;

/**
 * Make a staff search string safe to embed in a PostgREST `.or()` filter.
 *
 * `.or("name.ilike.%x%,phone.ilike.%x%")` is parsed as a mini-language: `,` starts a new filter,
 * `(` `)` open nested groups, `"` and `\` quote/escape, and `%` `_` `*` are LIKE wildcards. Passing raw
 * input through lets a caller inject extra conditions (e.g. `x,status.eq.new`). Names and phone
 * numbers never need those characters, so we keep only letters (and their combining marks, e.g. Bengali vowel signs), digits, spaces and `+ - . '`
 * and drop everything else. Returns "" when nothing searchable is left.
 */
export function sanitizeSearchTerm(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .normalize("NFKC")
    .replace(/[^\p{L}\p{M}\p{N}\s+\-.']/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SEARCH_MAX_LENGTH);
}

/** Searches with at least this many digits are treated as phone numbers. */
const PHONE_SEARCH_MIN_DIGITS = 6;

/**
 * Build the PostgREST `.or()` filter for the admin search box.
 *
 * Phones are stored as E.164 (`+919147718046`) but staff type "91477 18046". When the term has 6+
 * digits we match the phone column on the digits only (spaces, hyphens and `+` dropped). The name
 * column still uses the sanitised term. Both parts come from `sanitizeSearchTerm`, so the digits
 * and the text cannot add filters or wildcards. Returns null when there is nothing to search for.
 */
export function buildSearchFilter(raw: string | null | undefined): string | null {
  const term = sanitizeSearchTerm(raw);
  if (!term) return null;

  const digits = term.replace(/\D/g, "");
  const phoneTerm = digits.length >= PHONE_SEARCH_MIN_DIGITS ? digits : term;
  return `name.ilike.%${term}%,phone.ilike.%${phoneTerm}%`;
}

/** Extract and verify the Supabase Auth session token from the Request headers. */
export async function verifyAdminSession(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.warn("Unauthorized admin request: missing or malformed Bearer token");
    throw new AppError("VALIDATION", "Unauthorized: Staff login required", {
      status: 401,
      userMessage: "Unauthorized: Please log in with clinic staff credentials.",
    });
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    throw new AppError("VALIDATION", "Unauthorized: Empty token", {
      status: 401,
      userMessage: "Unauthorized: Please log in.",
    });
  }

  // Validate the token against Supabase Auth service
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    logger.warn("Unauthorized admin request: invalid or expired session token", {
      code: authError?.status,
    });
    throw new AppError("VALIDATION", "Unauthorized: Invalid or expired session token", {
      status: 401,
      userMessage: "Session expired. Please log in again.",
    });
  }

  // Authorization check: Ensure user is authorized clinic staff.
  // CRITICAL SECURITY: Only trust server-controlled app_metadata or the server-configured staff allowlist.
  // NEVER check user_metadata.role because user_metadata can be modified by the client.
  const user = authData.user;
  const role = user.app_metadata?.["role"];
  const isStaffRole = role === "admin" || role === "staff";

  const staffAllowlist = getStaffAllowlist();
  const userEmail = user.email?.trim().toLowerCase();
  // The allowlist matches on email, so the address must be verified by Supabase Auth. Otherwise
  // anyone could sign up with a staff address (when email confirmation is off) and be treated as staff.
  const isEmailVerified = Boolean(user.email_confirmed_at);
  const isAllowlistedEmail = Boolean(
    userEmail && isEmailVerified && staffAllowlist.includes(userEmail),
  );
  if (!isStaffRole && userEmail && !isEmailVerified && staffAllowlist.includes(userEmail)) {
    logger.warn("Staff allowlist match ignored: email address is not verified", {
      userId: user.id,
    });
  }

  if (!isStaffRole && !isAllowlistedEmail) {
    logger.warn("Forbidden admin request: authenticated user is not authorized clinic staff", {
      userId: user.id,
      // Helps diagnose a lockout: with STAFF_EMAILS unset there is no email-based access at all.
      staffAllowlistConfigured: staffAllowlist.length > 0,
    });
    throw new AppError("VALIDATION", "Forbidden: User is not authorized clinic staff", {
      status: 403,
      userMessage: "Access forbidden: You do not have staff permissions for this clinic.",
    });
  }

  return user;
}

/**
 * List appointments with pagination, status filtering, search, and notification outbox status.
 */
export async function handleListAdminAppointments(request: Request): Promise<Response> {
  await verifyAdminSession(request);

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    50,
    Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "15", 10) || 15),
  );
  const statusFilter = url.searchParams.get("status")?.trim();
  const searchFilter = buildSearchFilter(url.searchParams.get("search"));

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabaseAdmin
    .from("appointments")
    .select(
      "id, created_at, name, phone, email, preferred_date, preferred_time, message, source, status, treatment",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  if (searchFilter) {
    query = query.or(searchFilter);
  }

  const { data: appointments, count, error } = await query;

  if (error) {
    logger.error("Failed to query appointments for admin dashboard", { code: error.code });
    throw new AppError("SERVER", "Failed to retrieve appointment records", {
      status: 500,
      userMessage: "Could not load appointments. Please refresh.",
    });
  }

  // Fetch notification outbox statuses for the retrieved appointments
  const appointmentIds = (appointments ?? []).map((a) => a.id);
  const outboxMap = new Map<
    string,
    { status: string; attempts: number; last_error: string | null }
  >();

  if (appointmentIds.length > 0) {
    const { data: outboxRows } = await supabaseAdmin
      .from("notification_outbox")
      .select("appointment_id, status, attempts, last_error")
      .in("appointment_id", appointmentIds);

    for (const row of outboxRows ?? []) {
      outboxMap.set(row.appointment_id, {
        status: row.status,
        attempts: row.attempts,
        last_error: row.last_error,
      });
    }
  }

  const enrichedAppointments = (appointments ?? []).map((app) => ({
    ...app,
    notification: outboxMap.get(app.id) ?? { status: "none", attempts: 0, last_error: null },
  }));

  const totalCount = count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  return jsonOk(
    {
      appointments: enrichedAppointments,
      totalCount,
      page,
      pageSize,
      totalPages,
    },
    NO_STORE,
  );
}

/**
 * Update an appointment's status (e.g. called, confirmed, visited, cancelled).
 */
export async function handleUpdateAdminAppointmentStatus(request: Request): Promise<Response> {
  const staffUser = await verifyAdminSession(request);

  const { id, status } = await parseJsonBody(request, updateStatusSchema);

  // `.select("id")` returns the rows that were actually updated, so an unknown id gives an empty list.
  const { data: updatedRows, error } = await supabaseAdmin
    .from("appointments")
    .update({ status })
    .eq("id", id)
    .select("id");

  if (error) {
    logger.error("Failed to update appointment status", { code: error.code });
    throw new AppError("SERVER", "Database update failed", {
      status: 500,
      userMessage: "Failed to update appointment status.",
    });
  }

  if (!updatedRows || updatedRows.length === 0) {
    throw new AppError("VALIDATION", "Appointment not found", {
      status: 404,
      userMessage: "Appointment not found. It may have been removed; refresh the list.",
    });
  }

  // Staff user id only: no patient data in logs.
  logger.info("Appointment status updated successfully by staff", {
    id,
    status,
    staffUserId: staffUser.id,
  });
  return jsonOk({ id, status, updated: true }, NO_STORE);
}

/**
 * Manually trigger outbox notification retry from the admin dashboard.
 */
export async function handleRetryOutbox(request: Request): Promise<Response> {
  await verifyAdminSession(request);

  const result = await processNotificationOutbox(supabaseAdmin, 25);
  logger.info("Manual outbox retry triggered by staff", result);
  return jsonOk(result, NO_STORE);
}
