import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type FormEvent,
} from "react";
import { Field, SelectInput, TextAreaInput, TextInput } from "@/components/forms/fields";
import { publicEnv } from "@/config/env.public";
import { BOOKING_SOURCES, PREFERRED_TIMES } from "../constants";
import { getClinicToday } from "../dates";
import { useBookAppointment } from "../hooks/use-book-appointment";
import { validateBookingForm, type FieldErrors } from "../schemas";
import { BookingSuccess } from "./booking-success";

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

const subscribeNever = () => () => {};

/**
 * `false` while the page is server-rendered and while React is hydrating it, `true` once the
 * component is running in the browser. (On a purely client-side render it is `true` immediately.)
 */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

function readForm(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form));
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        },
      ) => string;
      reset?: (widgetId: string) => void;
      remove?: (widgetId: string) => void;
    };
  }
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
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileTokenRef = useRef<string | undefined>(undefined);
  const turnstileWidgetId = useRef<string | null>(null);
  // Turnstile is only enforced when a site key is configured. While enforced, the visitor can't
  // submit until the widget has produced a token (tokens are single-use, so this flips back to
  // false every time we reset the widget).
  const turnstileRequired = Boolean(publicEnv.turnstileSiteKey);
  const [turnstileReady, setTurnstileReady] = useState(!turnstileRequired);

  /** Tokens are single-use: drop the spent one and ask Cloudflare for a fresh challenge. */
  function resetTurnstile() {
    if (!turnstileRequired) return;
    turnstileTokenRef.current = undefined;
    setTurnstileReady(false);
    const id = turnstileWidgetId.current;
    if (id) {
      try {
        window.turnstile?.reset?.(id);
      } catch {
        // Widget already gone; nothing to reset.
      }
    }
  }

  useEffect(() => {
    if (!publicEnv.turnstileSiteKey || !turnstileContainerRef.current) return;

    function initTurnstile() {
      if (window.turnstile && turnstileContainerRef.current && !turnstileWidgetId.current) {
        try {
          turnstileWidgetId.current = window.turnstile.render(turnstileContainerRef.current, {
            sitekey: publicEnv.turnstileSiteKey!,
            callback: (token: string) => {
              turnstileTokenRef.current = token;
              setTurnstileReady(true);
            },
            "expired-callback": () => {
              turnstileTokenRef.current = undefined;
              setTurnstileReady(false);
            },
            "error-callback": () => {
              turnstileTokenRef.current = undefined;
              setTurnstileReady(false);
            },
            theme: "auto",
          });
        } catch {
          // Graceful fallback if widget fails to render
        }
      }
    }

    if (window.turnstile) {
      initTurnstile();
    } else {
      const scriptId = "cf-turnstile-script";
      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.onload = () => initTurnstile();
        document.head.appendChild(script);
      } else {
        // Script tag exists but hasn't finished loading (e.g. a second mount): render once it does.
        document.getElementById(scriptId)?.addEventListener("load", initTurnstile, { once: true });
      }
    }

    return () => {
      const id = turnstileWidgetId.current;
      if (id) {
        try {
          window.turnstile?.remove?.(id);
        } catch {
          // ignore
        }
        turnstileWidgetId.current = null;
      }
    };
  }, []);

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
    console.log("[booking-debug] handleSubmit fired");
    event.preventDefault();
    event.preventDefault();
    if (isPending) return; // never send the same request twice
    if (!turnstileReady) return; // challenge not solved yet; the button is disabled, this guards Enter-key submits

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
    const token = turnstileTokenRef.current;
    submit({ ...result.values, turnstile_token: token });
    // The token we just sent is now spent whatever the outcome. Request a fresh one straight away
    // so a retry after a server/validation error doesn't reuse it and get "bot verification failed".
    resetTurnstile();
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

      {/*
        Honeypot field for bot detection. Hidden from real users with CSS.
        Real visitors with CSS enabled never see or fill this field.
        The server also checks this field and silently discards filled submissions.
        aria-hidden + tabIndex=-1 prevents assistive tech from announcing it.
      */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-9999px",
          width: "1px",
          height: "1px",
          overflow: "hidden",
        }}
      >
        <label htmlFor="website-hp">Website</label>
        <input id="website-hp" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {/* Mandatory affirmative consent checkbox */}
      <div className="sm:col-span-2 flex flex-col gap-1 pt-1">
        <div className="flex items-start gap-2.5">
          <input
            id="privacy_consent"
            name="privacy_consent"
            type="checkbox"
            required
            aria-describedby="privacy-consent-hint"
            aria-invalid={Boolean(fieldErrors.privacy_consent)}
            className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-ring"
          />
          <label
            htmlFor="privacy_consent"
            id="privacy-consent-hint"
            className="text-xs text-muted-foreground leading-snug"
          >
            I consent to Elite Dental Clinic processing my contact details to coordinate and confirm
            my dental appointment. Details will not be shared with third parties for marketing.{" "}
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              View Privacy Notice (Draft)
            </a>
            .
          </label>
        </div>
        {fieldErrors.privacy_consent && (
          <p role="alert" className="text-xs text-destructive">
            {fieldErrors.privacy_consent}
          </p>
        )}
      </div>

      {/* Cloudflare Turnstile bot verification container (rendered when site key is configured) */}
      {publicEnv.turnstileSiteKey && (
        <div className="sm:col-span-2 flex justify-center py-1">
          <div ref={turnstileContainerRef} />
        </div>
      )}

      {errorMessage && (
        <p role="alert" className="sm:col-span-2 text-destructive text-sm">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={!hydrated || isPending || !turnstileReady}
        className={`btn-gold sm:col-span-2 disabled:opacity-60 ${FOCUS_RING}`}
      >
        {isPending
          ? "Sending…"
          : !turnstileReady
            ? "Verifying you're human…"
            : "Request Appointment"}
      </button>

      <p className="sm:col-span-2 text-xs text-muted-foreground text-center">
        Your contact information is used solely to coordinate and confirm your dental appointment.
      </p>
    </form>
  );
}
