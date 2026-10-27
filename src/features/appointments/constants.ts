/** Options offered by the booking form. Single source of truth for UI *and* validation. */
export const PREFERRED_TIMES = ["Morning", "Afternoon", "Evening"] as const;

export const BOOKING_SOURCES = [
  "Google search",
  "Google Maps",
  "Friend or family",
  "Instagram / Facebook",
  "Passed by the clinic",
  "Other",
] as const;

/** The form doesn't ask for a treatment; the DB column is NOT NULL. */
export const DEFAULT_TREATMENT = "Not specified";

/** Secure server-side appointment creation endpoint. */
export const CREATE_APPOINTMENT_ENDPOINT = "/api/create-appointment";

export const NOTIFY_ENDPOINT = "/api/notify-appointment";

export const BOOKING_ERROR_MESSAGE = "Something went wrong. Please call us instead.";
