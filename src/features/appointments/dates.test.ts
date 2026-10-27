import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DATE_MESSAGES,
  getAppointmentDateError,
  getClinicToday,
  isValidCalendarDate,
} from "./dates";

// Fixed clock: 01:30 IST on 27 Oct 2026 is still 26 Oct in UTC - exactly the window
// where the old `new Date().toISOString().slice(0, 10)` returned the wrong day.
const EARLY_MORNING_IST = new Date("2026-10-26T20:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(EARLY_MORNING_IST);
});
afterEach(() => vi.useRealTimers());

describe("getClinicToday", () => {
  it("returns the calendar date in the clinic timezone, not UTC", () => {
    expect(new Date().toISOString().slice(0, 10)).toBe("2026-10-26"); // the UTC date (the old bug)
    expect(getClinicToday()).toBe("2026-10-27");
  });

  it("rolls over at midnight IST, not midnight UTC", () => {
    expect(getClinicToday(new Date("2026-10-27T18:29:59Z"))).toBe("2026-10-27"); // 23:59:59 IST
    expect(getClinicToday(new Date("2026-10-27T18:30:00Z"))).toBe("2026-10-28"); // 00:00:00 IST
  });

  it("respects an explicit timezone", () => {
    expect(getClinicToday(EARLY_MORNING_IST, "UTC")).toBe("2026-10-26");
  });

  it("handles month and year boundaries", () => {
    expect(getClinicToday(new Date("2026-12-31T19:00:00Z"))).toBe("2027-01-01");
  });
});

describe("isValidCalendarDate", () => {
  it.each(["2026-10-27", "2028-02-29", "2026-12-31"])("accepts %s", (value) => {
    expect(isValidCalendarDate(value)).toBe(true);
  });

  it.each([
    "2026-02-30",
    "2026-02-29", // 2026 is not a leap year
    "2026-13-01",
    "2026-00-10",
    "2026-04-31",
    "2026-10-00",
    "2026-1-5",
    "26-10-27",
    "27/10/2026",
    "2026-10-27T00:00:00Z",
    "0000-01-01",
    "not a date",
    "",
  ])("rejects %j", (value) => {
    expect(isValidCalendarDate(value)).toBe(false);
  });
});

describe("getAppointmentDateError", () => {
  it("allows today (clinic time), even when the UTC date is still yesterday", () => {
    expect(getAppointmentDateError("2026-10-27")).toBeNull();
  });

  it("rejects yesterday (clinic time) - which a UTC comparison would have allowed", () => {
    expect(getAppointmentDateError("2026-10-26")).toBe(DATE_MESSAGES.past);
  });

  it("rejects dates in the past", () => {
    expect(getAppointmentDateError("2025-01-01")).toBe(DATE_MESSAGES.past);
  });

  it("allows future dates", () => {
    expect(getAppointmentDateError("2026-10-28")).toBeNull();
    expect(getAppointmentDateError("2027-03-01")).toBeNull();
  });

  it("reports missing and impossible dates distinctly", () => {
    expect(getAppointmentDateError("")).toBe(DATE_MESSAGES.required);
    expect(getAppointmentDateError("2026-02-30")).toBe(DATE_MESSAGES.invalid);
  });

  it("follows the clock: today becomes 'past' after midnight IST", () => {
    const afterMidnight = new Date("2026-10-27T18:30:00Z"); // 00:00 on the 28th IST
    expect(getAppointmentDateError("2026-10-27", afterMidnight)).toBe(DATE_MESSAGES.past);
    expect(getAppointmentDateError("2026-10-28", afterMidnight)).toBeNull();
  });
});
