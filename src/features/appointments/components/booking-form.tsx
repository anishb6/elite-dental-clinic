import { useRef, useState, type FocusEvent, type FormEvent } from "react";
import { Field, SelectInput, TextAreaInput, TextInput } from "@/components/forms/fields";
import { useHydrated } from "@/hooks/use-hydrated";
import { BOOKING_SOURCES, PREFERRED_TIMES } from "../constants";
import { getClinicToday } from "../dates";
import { useBookAppointment } from "../hooks/use-book-appointment";
import { useTurnstile } from "../hooks/use-turnstile";
import { validateBookingForm, type FieldErrors } from "../schemas";
import { BookingSuccess } from "./booking-success";
import { HoneypotField } from "./honeypot-field";
import { PrivacyConsentField } from "./privacy-consent-field";

const FIELD_ORDER = [
  "name",
  "phone",
  "email",
  "preferred_date",
  "preferred_time",
  "source",
  "message",
  "privacy_consent",
] as const;
const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function readForm(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form));
}

/**
 * Booking form: validates locally (same schema the server uses), then delegates the
 * submit workflow to `useBookAppointment`. Inputs are uncontrolled, so whatever the
 * visitor typed stays in place when validation or the request fails.
 *
 * Includes:
 * - Honeypot field (`website`) that is hidden from real users with CSS.
 * - Turnstile widget challenge (when VITE_CLOUDFLARE_TURNSTILE_SITE_KEY is provided).
 * - Mandatory affirmative privacy consent.
 */
export function BookingForm() {
  const { submit, isPending, isSuccess, errorMessage } = useBookAppointment();
  // The form is server-rendered and visible before the JS bundle has hydrated it. Until React has
  // attached `onSubmit`, a click would fall through to the browser's native GET submission and put
  // the visitor's name and phone number in the URL. So the button stays disabled until hydration.
  const hydrated = useHydrated();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const submitAttempted = useRef(false);
  const turnstile = useTurnstile();

  if (isSuccess) return <BookingSuccess />;

  /** Re-validate one field in the context of the whole form and update only its error. */
  function validateField(form: HTMLFormElement, name: string) {
    const result = validateBookingForm(readForm(form));
    const message = result.ok ? undefined : result.errors[name as keyof FieldErrors];
    setFieldErrors((current) => {
      if (current[name as keyof FieldErrors] === message) return current;
      const { [name as keyof FieldErrors]: _removed, ...rest } = current;
      return message ? { ...rest, [name]: message } : rest;
    });
  }

  // Show a field's error when the visitor leaves it (once they've typed something or tried to submit)...
  function handleBlur(event: FocusEvent<HTMLFormElement>) {
    const target = event.target as unknown as HTMLInputElement;
    if (!target.name) return;
    if (submitAttempted.current || target.value !== "")
      validateField(event.currentTarget, target.name);
  }

  // ...and, while a field shows an error, re-check it on every change so it clears as soon as it's fixed.
  function handleChange(event: FormEvent<HTMLFormElement>) {
    const target = event.target as unknown as HTMLInputElement;
    if (target.name && fieldErrors[target.name as keyof FieldErrors]) {
      validateField(event.currentTarget, target.name);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return; // never send the same request twice
    if (!turnstile.ready) return; // challenge not solved yet; the button is disabled, this guards Enter-key submits

    submitAttempted.current = true;
    const form = event.currentTarget;

    // Honeypot check: bots often fill in every visible (and invisible) field.
    // The `website` field is intentionally hidden; real users never fill it in.
    const data = readForm(form);
    if (data["website"]) return; // silently discard bot submissions

    const result = validateBookingForm(data);
    if (!result.ok) {
      setFieldErrors(result.errors);
      const firstInvalid = FIELD_ORDER.find((name) => result.errors[name]);
      (form.elements.namedItem(firstInvalid ?? "") as HTMLElement | null)?.focus();
      return;
    }
    setFieldErrors({});
    submit({ ...result.values, turnstile_token: turnstile.getToken() });
    // The token we just sent is now spent whatever the outcome. Request a fresh one straight away
    // so a retry after a server/validation error doesn't reuse it and get "bot verification failed".
    turnstile.reset();
  }

  return (
    <form
      onSubmit={handleSubmit}
      onBlur={handleBlur}
      onChange={handleChange}
      noValidate
      aria-busy={isPending}
      className="grid gap-5 sm:grid-cols-2"
    >
      <p className="sm:col-span-2 text-sm text-muted-foreground">
        Fields marked <span className="text-destructive">*</span> are required.
      </p>
      <Field label="Full name" required error={fieldErrors.name} className="sm:col-span-2">
        {(a) => <TextInput name="name" maxLength={100} autoComplete="name" {...a} />}
      </Field>
      <Field
        label="Phone"
        required
        error={fieldErrors.phone}
        hint="10-digit Indian mobile number, or include your country code."
      >
        {(a) => (
          <TextInput
            name="phone"
            type="tel"
            inputMode="tel"
            maxLength={20}
            autoComplete="tel"
            {...a}
          />
        )}
      </Field>
      <Field label="Email" error={fieldErrors.email}>
        {(a) => <TextInput name="email" type="email" maxLength={255} autoComplete="email" {...a} />}
      </Field>
      <Field label="Preferred date" required error={fieldErrors.preferred_date}>
        {(a) => <TextInput name="preferred_date" type="date" min={getClinicToday()} {...a} />}
      </Field>
      <Field label="Preferred time" required error={fieldErrors.preferred_time}>
        {(a) => (
          <SelectInput
            name="preferred_time"
            options={PREFERRED_TIMES}
            placeholder="Select"
            placeholderDisabled
            {...a}
          />
        )}
      </Field>
      <Field label="How did you find us?" error={fieldErrors.source} className="sm:col-span-2">
        {(a) => (
          <SelectInput
            name="source"
            options={BOOKING_SOURCES}
            placeholder="Select (optional)"
            {...a}
          />
        )}
      </Field>
      <Field
        label="What do you need help with?"
        error={fieldErrors.message}
        className="sm:col-span-2"
      >
        {(a) => <TextAreaInput name="message" rows={4} maxLength={1000} {...a} />}
      </Field>

      <HoneypotField />

      <PrivacyConsentField error={fieldErrors.privacy_consent} />

      {/* Cloudflare Turnstile bot verification container (rendered when site key is configured) */}
      {turnstile.required && (
        <div className="sm:col-span-2 flex justify-center py-1">
          <div ref={turnstile.containerRef} />
        </div>
      )}

      {errorMessage && (
        <p role="alert" className="sm:col-span-2 text-destructive text-sm">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={!hydrated || isPending || !turnstile.ready}
        className={`btn-gold sm:col-span-2 disabled:opacity-60 ${FOCUS_RING}`}
      >
        {isPending
          ? "Sending…"
          : !turnstile.ready
            ? "Verifying you're human…"
            : "Request Appointment"}
      </button>

      <p className="sm:col-span-2 text-xs text-muted-foreground text-center">
        Your contact information is used solely to coordinate and confirm your dental appointment.
      </p>
    </form>
  );
}
