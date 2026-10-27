import { describe, expect, it } from "vitest";
import { buildAnalyticsScripts, classifyLink } from "./analytics";

describe("classifyLink", () => {
  it.each([
    ["tel:+919147718046", "call_click"],
    ["https://wa.me/919147718046", "whatsapp_click"],
    ["https://maps.app.goo.gl/abc", "directions_click"],
    ["/book", "book_click"],
    ["/book?x=1", "book_click"],
    ["/about", null],
  ])("%s -> %s", (href, expected) => {
    expect(classifyLink(href)).toBe(expected);
  });
});

describe("buildAnalyticsScripts", () => {
  it("returns nothing when GA is not configured", () => {
    expect(buildAnalyticsScripts(undefined)).toEqual([]);
  });
  it("loads gtag when configured", () => {
    expect(buildAnalyticsScripts("G-TEST123")[0]).toMatchObject({ async: true });
  });
});
