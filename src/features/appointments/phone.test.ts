import { describe, expect, it } from "vitest";
import { normalizePhone, PHONE_MESSAGES } from "./phone";

const ok = (input: string) => {
  const result = normalizePhone(input);
  if (!result.ok) throw new Error(`expected ${input} to be valid: ${result.message}`);
  return result.value;
};
const message = (input: string) => {
  const result = normalizePhone(input);
  if (result.ok) throw new Error(`expected ${input} to be rejected`);
  return result.message;
};

describe("normalizePhone - accepted Indian mobile formats all normalise to the same E.164 value", () => {
  it.each([
    "9147718046",
    "91477 18046",
    "91477-18046",
    "09147718046",
    "919147718046",
    "+919147718046",
    "+91 91477 18046",
    "+91-91477-18046",
    "0091 91477 18046",
    "  +91 91477 18046  ",
  ])("%j", (input) => {
    expect(ok(input)).toBe("+919147718046");
  });

  it("is idempotent", () => {
    expect(ok(ok("91477 18046"))).toBe("+919147718046");
  });

  it.each(["6000000000", "7000000000", "8000000000", "9999999999"])("accepts %s", (input) => {
    expect(ok(input)).toBe(`+91${input}`);
  });
});

describe("normalizePhone - international numbers need an explicit country code", () => {
  it("keeps them, minus separators", () => {
    expect(ok("+44 20 7946 0958")).toBe("+442079460958");
    expect(ok("0044 20 7946 0958")).toBe("+442079460958");
    expect(ok("+1 415-555-0132")).toBe("+14155550132");
  });
});

describe("normalizePhone - rejections", () => {
  it("requires a value", () => {
    expect(message("")).toBe(PHONE_MESSAGES.required);
    expect(message("   ")).toBe(PHONE_MESSAGES.required);
    expect(normalizePhone("+").ok).toBe(false);
  });

  it.each([
    "abc",
    "91477x18046",
    "(91477) 18046",
    "9147718046 ext 2",
    "91+4771 8046",
    "++919147718046",
  ])("rejects disallowed characters or misplaced + in %j", (input) => {
    expect(message(input)).toBe(PHONE_MESSAGES.characters);
  });

  it("rejects separator-only values that the old pattern accepted", () => {
    expect(message("------")).toBe(PHONE_MESSAGES.required);
    expect(message("- - - - - -")).toBe(PHONE_MESSAGES.required);
  });

  it.each([
    ["too short", "91477"],
    ["too long", "914771804612345"],
    ["9 digits", "914771804"],
    ["Indian number not starting 6-9", "5147718046"],
    ["+91 with 9 digits", "+91 91477 1804"],
    ["+91 with 11 digits", "+91 91477 180460"],
    ["+91 landline-looking", "+91 33 2345 6789"],
  ])("rejects %s", (_label, input) => {
    expect(normalizePhone(input).ok).toBe(false);
  });

  it("uses an Indian-specific message for +91 numbers and a country-code message otherwise", () => {
    expect(message("+91 12345")).toBe(PHONE_MESSAGES.indian);
    expect(message("+0 1234 5678")).toBe(PHONE_MESSAGES.international);
    expect(message("12345")).toBe(PHONE_MESSAGES.unrecognised);
  });
});
