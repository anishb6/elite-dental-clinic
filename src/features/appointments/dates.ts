/**
 * Appointment-date rules, shared by the form (`min` attribute + validation) and the
 * server. A preferred date is a plain calendar date (`YYYY-MM-DD`, stored in a
 * Postgres `date` column) - never a timestamp - so it is compared as a string
 * against "today" in the clinic's timezone and is never routed through UTC.
 */
import { CLINIC_TIMEZONE } from "@/config/site";

export const DATE_MESSAGES = {
  required: "Choose a date",
  invalid: "Enter a valid date",
  past: "Please choose today or a later date",
} as const;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Today's calendar date (`YYYY-MM-DD`) in the clinic's timezone - NOT the UTC date. */
export function getClinicToday(now: Date = new Date(), timeZone: string = CLINIC_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** True for a real calendar date in strict `YYYY-MM-DD` form (rejects 2026-02-30, 2026-13-01, 2026-1-5). */
export function isValidCalendarDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < 1900) return false;
  // UTC is used purely as calendar arithmetic to check the parts round-trip; the value itself is not shifted.
  const check = new Date(Date.UTC(year, month - 1, day));
  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
  );
}

/** Returns an error message, or `null` when `value` is a valid date that is today or later (clinic time). */
export function getAppointmentDateError(value: string, now: Date = new Date()): string | null {
  if (value === "") return DATE_MESSAGES.required;
  if (!isValidCalendarDate(value)) return DATE_MESSAGES.invalid;
  // Both sides are zero-padded ISO dates, so string comparison is calendar comparison.
  if (value < getClinicToday(now)) return DATE_MESSAGES.past;
  return null;
}

/**
 * Validates a preferred date for an *already accepted* booking (e.g. during notification processing
 * or notification retries across midnight).
 *
 * If `acceptedAt` is provided (e.g. appointment creation timestamp), the preferred date is checked
 * against the clinic date at the time the booking was accepted, rather than the current clock time.
 * This prevents the midnight edge case where a booking accepted at 23:59 IST for today is incorrectly
 * rejected as "past" when the notification is processed or retried after 00:00 IST.
 */
export function getAcceptedAppointmentDateError(
  value: string,
  acceptedAt?: Date | string | null,
  now: Date = new Date(),
): string | null {
  if (value === "") return DATE_MESSAGES.required;
  if (!isValidCalendarDate(value)) return DATE_MESSAGES.invalid;

  let referenceTime = now;
  if (acceptedAt) {
    const parsed = new Date(acceptedAt);
    if (!isNaN(parsed.getTime())) {
      referenceTime = parsed;
    }
  }

  if (value < getClinicToday(referenceTime)) return DATE_MESSAGES.past;
  return null;
}
