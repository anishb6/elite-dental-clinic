/**
 * Phone validation + normalisation (shared by the form and the server).
 *
 * Scope: this is an Indian clinic (+91, WhatsApp 91…), so the primary supported
 * format is an **Indian mobile number**. Visitors abroad may also enter an
 * international number, but only with an explicit country code (`+` or `00`).
 *
 * Accepted input characters: digits, spaces and hyphens, with an optional leading `+`.
 * Anything else (letters, brackets, a `+` in the middle…) is rejected rather than stripped.
 *
 * Output is E.164 (`+919147718046`), which is what we store and e-mail to the clinic.
 * Normalising an already-normalised value returns it unchanged (idempotent).
 */

export type PhoneResult = { ok: true; value: string } | { ok: false; message: string };

export const PHONE_MESSAGES = {
  required: "Please enter your phone number",
  characters: "Phone number can only contain digits, spaces and hyphens (and a leading +)",
  indian: "Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9 (e.g. 91477 18046)",
  international: "Enter the number with its country code, e.g. +44 20 7946 0958",
  unrecognised: "Enter a 10-digit Indian mobile number, or an international number starting with +",
} as const;

const INDIAN_MOBILE = /^[6-9]\d{9}$/;
const INTERNATIONAL = /^[1-9]\d{7,14}$/; // E.164: up to 15 digits, no leading zero
const ALLOWED_CHARACTERS = /^\+?[\d\s-]+$/;

function indian(national: string): PhoneResult {
  return INDIAN_MOBILE.test(national)
    ? { ok: true, value: `+91${national}` }
    : { ok: false, message: PHONE_MESSAGES.indian };
}

export function normalizePhone(input: string): PhoneResult {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: false, message: PHONE_MESSAGES.required };
  if (!ALLOWED_CHARACTERS.test(trimmed)) return { ok: false, message: PHONE_MESSAGES.characters };

  const hasPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/[\s-]/g, "").replace(/^\+/, "");
  if (digits === "") return { ok: false, message: PHONE_MESSAGES.required };

  // "00" is the international dialling prefix, equivalent to "+".
  const international = hasPlus || digits.startsWith("00");
  if (!hasPlus && digits.startsWith("00")) digits = digits.slice(2);

  if (international) {
    if (digits.startsWith("91")) return indian(digits.slice(2));
    return INTERNATIONAL.test(digits)
      ? { ok: true, value: `+${digits}` }
      : { ok: false, message: PHONE_MESSAGES.international };
  }

  // No country code: a bare Indian mobile, optionally written with a trunk "0" or "91".
  if (digits.length === 10) return indian(digits);
  if (digits.length === 11 && digits.startsWith("0")) return indian(digits.slice(1));
  if (digits.length === 12 && digits.startsWith("91")) return indian(digits.slice(2));
  return { ok: false, message: PHONE_MESSAGES.unrecognised };
}
