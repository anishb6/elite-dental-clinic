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

/**
 * Version of the privacy notice a patient agrees to when they tick the consent box. Stored with
 * every booking. Change it whenever the notice (`src/routes/privacy.tsx`) changes in a way that
 * affects what patients consent to.
 */
export const PRIVACY_POLICY_VERSION = "2026-10-31";

/** The form doesn't ask for a treatment; the DB column is NOT NULL. */
export const DEFAULT_TREATMENT = "Not specified";

export const BOOKING_ERROR_MESSAGE = "Something went wrong. Please call us instead.";
