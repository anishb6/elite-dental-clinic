import { z } from "zod";
import { BOOKING_SOURCES, PREFERRED_TIMES } from "./constants";
import { getAcceptedAppointmentDateError, getAppointmentDateError } from "./dates";
import { normalizePhone } from "./phone";

/**
 * One definition per field, used by BOTH the browser form schema and the server
 * payload schema, so the two can never disagree about what is valid.
 */
const NAME_MAX = 100;
const EMAIL_MAX = 255;
const MESSAGE_MAX = 1000;

const text = (requiredMessage: string) =>
  z.string({ required_error: requiredMessage, invalid_type_error: requiredMessage });

const nameField = text("Please enter your name")
  .trim()
  .min(1, "Please enter your name")
  .max(NAME_MAX, `Name must be ${NAME_MAX} characters or fewer`)
  .refine((value) => /\p{L}/u.test(value), "Name should contain letters");

/** Validates and normalises to E.164 (`+919147718046`); see `phone.ts`. */
const phoneField = text("Please enter your phone number").transform((value, ctx) => {
  const result = normalizePhone(value);
  if (!result.ok) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.message });
    return z.NEVER;
  }
  return result.value;
});

const emailField = text("Enter a valid email address")
  .trim()
  .max(EMAIL_MAX, `Email must be ${EMAIL_MAX} characters or fewer`)
  .email("Enter a valid email address");

/** Date-only value, compared with today's date in the clinic timezone (see `dates.ts`). */
const dateField = text("Choose a date").superRefine((value, ctx) => {
  const message = getAppointmentDateError(value);
  if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
});

const timeField = z.enum(PREFERRED_TIMES, { errorMap: () => ({ message: "Choose a time" }) });

const messageField = text("Message must be text")
  .trim()
  .max(MESSAGE_MAX, `Message must be ${MESSAGE_MAX} characters or fewer`);

const sourceField = z.enum(BOOKING_SOURCES, {
  errorMap: () => ({ message: "Choose one of the listed options" }),
});

/** An untouched optional input arrives as "" - treat blank as "not provided". */
const optional = <S extends z.ZodTypeAny>(schema: S) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    schema.optional(),
  );

/** Explicit affirmative privacy consent under DPDP Act standards. */
export const privacyConsentField = z.preprocess(
  (val) => (val === true || val === "true" || val === "on" ? true : false),
  z.literal(true, {
    errorMap: () => ({ message: "You must consent to the privacy policy to book an appointment" }),
  }),
);

/**
 * Shape of the raw `<form>` values as entered by the visitor.
 * Output values are already trimmed and the phone is normalised.
 */
export const bookingFormSchema = z.object({
  name: nameField,
  phone: phoneField,
  email: optional(emailField),
  preferred_date: dateField,
  preferred_time: timeField,
  message: optional(messageField),
  source: optional(sourceField),
  privacy_consent: privacyConsentField,
});

export type BookingFormValues = z.infer<typeof bookingFormSchema>;

/**
 * Server request schema for appointment creation. Includes optional honeypot
 * field (`website`) to detect automated bot submissions, Turnstile challenge tokens,
 * and strict required affirmative privacy consent.
 */
export const createAppointmentSchema = bookingFormSchema.extend({
  website: optional(z.string()),
  turnstile_token: optional(z.string()),
  privacy_consent: privacyConsentField,
});

export type CreateAppointmentValues = z.infer<typeof createAppointmentSchema>;

/**
 * Request schema for the internal appointment notification endpoint.
 * Requires a verified database UUID and does not accept client-provided patient data.
 */
export const notifyAppointmentRequestSchema = z.object({
  appointment_id: z.string().uuid("Invalid appointment ID format (UUID expected)"),
});

export type NotifyAppointmentRequest = z.infer<typeof notifyAppointmentRequestSchema>;

/**
 * Normalised appointment request - what is stored in the database and sent to the
 * notification endpoint. Optional text fields are `null` rather than "".
 * The server re-validates this schema, never trusting the browser.
 * Supports an optional `created_at` timestamp representing when the appointment was
 * accepted; if present, the calendar date is validated against the clinic date at
 * `created_at`, handling the midnight race condition gracefully.
 */
export const appointmentPayloadSchema = z
  .object({
    id: z.string().uuid().optional(),
    created_at: z.string().optional().nullable(),
    name: nameField,
    phone: phoneField,
    email: emailField.nullable(),
    preferred_date: text("Choose a date"),
    preferred_time: timeField,
    message: messageField.nullable(),
    source: sourceField.nullable(),
    privacy_consent: z.boolean().optional(),
    turnstile_token: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const message = getAcceptedAppointmentDateError(data.preferred_date, data.created_at);
    if (message) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["preferred_date"],
        message,
      });
    }
  });

export type AppointmentPayload = z.infer<typeof appointmentPayloadSchema>;

/** Business rule: turn validated form values into the payload we persist. */
export function toAppointmentPayload(
  values: BookingFormValues & { turnstile_token?: string | undefined },
): AppointmentPayload {
  return {
    name: values.name,
    phone: values.phone,
    email: values.email ?? null,
    preferred_date: values.preferred_date,
    preferred_time: values.preferred_time,
    message: values.message ?? null,
    source: values.source ?? null,
    privacy_consent: values.privacy_consent,
    turnstile_token: values.turnstile_token,
  };
}

export type FieldErrors = Partial<Record<keyof BookingFormValues, string>>;

/** Validate raw form data and return either values or one message per field. */
export function validateBookingForm(
  raw: Record<string, unknown>,
): { ok: true; values: BookingFormValues } | { ok: false; errors: FieldErrors } {
  const result = bookingFormSchema.safeParse(raw);
  if (result.success) return { ok: true, values: result.data };

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof BookingFormValues | undefined;
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors };
}
