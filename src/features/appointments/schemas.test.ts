import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PREFERRED_TIMES } from "./constants";
import {
  appointmentPayloadSchema,
  createAppointmentSchema,
  toAppointmentPayload,
  validateBookingForm,
} from "./schemas";

// "Today" is 27 Oct 2026 in the clinic timezone for every test in this file.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-27T06:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const valid = {
  name: "  Asha Roy ",
  phone: "+91 91477 18046",
  email: "",
  preferred_date: "2026-11-05",
  preferred_time: "Evening",
  message: "",
  source: "",
  privacy_consent: true,
};

function errorsFor(overrides: Record<string, unknown>) {
  const result = validateBookingForm({ ...valid, ...overrides });
  if (result.ok) throw new Error("expected validation to fail");
  return result.errors;
}

describe("validateBookingForm", () => {
  it("accepts a complete form, trims values and normalises the phone", () => {
    const result = validateBookingForm(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.name).toBe("Asha Roy");
      expect(result.values.phone).toBe("+919147718046");
    }
  });

  it("accepts every optional field filled in", () => {
    const result = validateBookingForm({
      ...valid,
      email: " asha@example.com ",
      message: " Toothache ",
      source: "Google Maps",
    });
    expect(result.ok && result.values).toMatchObject({
      email: "asha@example.com",
      message: "Toothache",
      source: "Google Maps",
    });
  });

  it("reports one field-specific message per invalid field", () => {
    const result = validateBookingForm({ ...valid, name: "", phone: "abc", preferred_time: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.name).toBe("Please enter your name");
      expect(result.errors.phone).toMatch(/digits, spaces and hyphens/);
      expect(result.errors.preferred_time).toBe("Choose a time");
      expect(result.errors.preferred_date).toBeUndefined();
    }
  });

  it("treats missing fields like empty ones", () => {
    const result = validateBookingForm({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toMatchObject({
        name: "Please enter your name",
        phone: "Please enter your phone number",
        preferred_date: "Choose a date",
        preferred_time: "Choose a time",
      });
      expect(result.errors.email).toBeUndefined();
      expect(result.errors.source).toBeUndefined();
    }
  });

  describe("name", () => {
    it("rejects whitespace-only, over-long and letterless names", () => {
      expect(errorsFor({ name: "   " }).name).toBe("Please enter your name");
      expect(errorsFor({ name: "a".repeat(101) }).name).toBe(
        "Name must be 100 characters or fewer",
      );
      expect(errorsFor({ name: "12345" }).name).toBe("Name should contain letters");
    });

    it("accepts a 100-character name and non-Latin names", () => {
      expect(validateBookingForm({ ...valid, name: "a".repeat(100) }).ok).toBe(true);
      expect(validateBookingForm({ ...valid, name: "অনীশ ব্যানার্জী" }).ok).toBe(true);
    });
  });

  describe("email and message (optional)", () => {
    it("rejects a malformed or over-long email", () => {
      expect(errorsFor({ email: "not-an-email" }).email).toBe("Enter a valid email address");
      expect(errorsFor({ email: `${"a".repeat(250)}@x.com` }).email).toBe(
        "Email must be 255 characters or fewer",
      );
    });

    it("rejects an over-long message", () => {
      expect(errorsFor({ message: "x".repeat(1001) }).message).toBe(
        "Message must be 1000 characters or fewer",
      );
      expect(validateBookingForm({ ...valid, message: "x".repeat(1000) }).ok).toBe(true);
    });
  });

  describe("time slot", () => {
    it.each(PREFERRED_TIMES)("accepts %s", (slot) => {
      expect(validateBookingForm({ ...valid, preferred_time: slot }).ok).toBe(true);
    });

    it.each(["Midnight", "morning", "10:30", "Morning "])("rejects %j", (slot) => {
      expect(errorsFor({ preferred_time: slot }).preferred_time).toBe("Choose a time");
    });
  });

  describe("source (the only fixed 'how did you find us' list; the form has no treatment field)", () => {
    it("rejects values outside the list", () => {
      expect(errorsFor({ source: "Carrier pigeon" }).source).toBe(
        "Choose one of the listed options",
      );
    });
  });

  describe("appointment date (clinic-local 'today' is 2026-10-27)", () => {
    it("accepts today and future dates", () => {
      expect(validateBookingForm({ ...valid, preferred_date: "2026-10-27" }).ok).toBe(true);
      expect(validateBookingForm({ ...valid, preferred_date: "2026-10-28" }).ok).toBe(true);
      expect(validateBookingForm({ ...valid, preferred_date: "2027-01-01" }).ok).toBe(true);
    });

    it("rejects past dates", () => {
      expect(errorsFor({ preferred_date: "2026-10-26" }).preferred_date).toBe(
        "Please choose today or a later date",
      );
      expect(errorsFor({ preferred_date: "2020-01-01" }).preferred_date).toBe(
        "Please choose today or a later date",
      );
    });

    it("rejects invalid calendar dates and wrong formats", () => {
      for (const bad of [
        "2026-02-30",
        "2026-13-01",
        "2026-11-5",
        "05/11/2026",
        "2026-11-05T00:00:00Z",
      ]) {
        expect(errorsFor({ preferred_date: bad }).preferred_date).toBe("Enter a valid date");
      }
      expect(errorsFor({ preferred_date: "" }).preferred_date).toBe("Choose a date");
    });
  });

  describe("privacy_consent", () => {
    it("rejects false or missing privacy consent", () => {
      expect(errorsFor({ privacy_consent: false }).privacy_consent).toBe(
        "You must consent to the privacy policy to book an appointment",
      );
      expect(errorsFor({ privacy_consent: undefined }).privacy_consent).toBe(
        "You must consent to the privacy policy to book an appointment",
      );
    });

    it("accepts truthy consent values", () => {
      expect(validateBookingForm({ ...valid, privacy_consent: true }).ok).toBe(true);
      expect(validateBookingForm({ ...valid, privacy_consent: "on" }).ok).toBe(true);
      expect(validateBookingForm({ ...valid, privacy_consent: "true" }).ok).toBe(true);
    });
  });
});

describe("toAppointmentPayload", () => {
  it("turns empty optional fields into null", () => {
    const result = validateBookingForm(valid);
    if (!result.ok) throw new Error("expected valid form");
    const payload = toAppointmentPayload(result.values);
    expect(payload).toMatchObject({
      email: null,
      message: null,
      source: null,
      phone: "+919147718046",
    });
    expect(appointmentPayloadSchema.safeParse(payload).success).toBe(true);
  });
});

describe("shared validation: form and server schema agree", () => {
  const payload = {
    name: "Asha Roy",
    phone: "+919147718046",
    email: null,
    preferred_date: "2026-11-05",
    preferred_time: "Evening",
    message: null,
    source: null,
  };

  it("the server accepts exactly what the form produces, with an identical phone", () => {
    const form = validateBookingForm({ ...valid, email: "a@b.co", message: "Hi", source: "Other" });
    if (!form.ok) throw new Error("expected valid form");
    const sent = toAppointmentPayload(form.values);
    const server = appointmentPayloadSchema.safeParse(sent);
    expect(server.success && server.data).toEqual(sent);
  });

  it("the server also normalises a raw phone, so both paths store the same representation", () => {
    const server = appointmentPayloadSchema.parse({ ...payload, phone: "091477 18046" });
    expect(server.phone).toBe("+919147718046");
  });

  it.each([
    ["phone", { phone: "abc" }],
    ["phone", { phone: "------" }],
    ["preferred_date", { preferred_date: "2026-10-26" }],
    ["preferred_date", { preferred_date: "2026-02-30" }],
    ["preferred_time", { preferred_time: "Midnight" }],
    ["name", { name: "" }],
    ["source", { source: "Carrier pigeon" }],
    ["email", { email: "nope" }],
  ])("the server rejects what the form rejects (%s)", (_field, override) => {
    const raw = { ...valid, ...override };
    expect(validateBookingForm(raw).ok).toBe(false);
    expect(appointmentPayloadSchema.safeParse({ ...payload, ...override }).success).toBe(false);
  });

  it("server error messages never echo the submitted value (so they are safe to log)", () => {
    const result = appointmentPayloadSchema.safeParse({ ...payload, phone: "SECRET-9147718046x" });
    expect(JSON.stringify(result.error?.issues)).not.toContain("9147718046");
  });
});
