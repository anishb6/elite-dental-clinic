import { describe, expect, it } from "vitest";
import { publicEnv } from "@/config/env.public";
import { buildAppointmentEmail, escapeHtml } from "./appointment-email.server";

const base = {
  name: "Asha",
  phone: "9147718046",
  email: null,
  preferred_date: "2026-11-05",
  preferred_time: "Morning" as const,
  message: null,
  source: null,
};

describe("escapeHtml", () => {
  it("escapes markup characters", () => {
    expect(escapeHtml(`<b onclick="x">&`)).toBe("&lt;b onclick=&quot;x&quot;&gt;&amp;");
  });
});

describe("buildAppointmentEmail", () => {
  it("escapes user input in the body and omits raw clinical notes for privacy", () => {
    const sensitiveNote = "Undergoing root canal treatment with severe toothache";
    const { html } = buildAppointmentEmail({
      ...base,
      name: "<b>Asha</b>",
      message: sensitiveNote,
    });
    expect(html).not.toContain("<b>Asha</b>");
    expect(html).toContain("&lt;b&gt;Asha&lt;/b&gt;");
    // Ensure raw medical note is never included in the email payload
    expect(html).not.toContain(sensitiveNote);
    expect(html).toContain("Yes (confidential — view in staff portal)");
  });

  it("indicates when no notes were provided", () => {
    const { html } = buildAppointmentEmail({ ...base, message: null });
    expect(html).toContain("None");
  });

  it("strips line breaks from the subject (header-injection guard)", () => {
    const { subject } = buildAppointmentEmail({ ...base, name: "Asha\r\nBcc: evil@example.com" });
    expect(subject).not.toMatch(/[\r\n]/);
  });

  it("builds the dashboard link from the supplied site origin, not a hard-coded domain", () => {
    const { html } = buildAppointmentEmail(base, "https://staging.example.test");
    expect(html).toContain('href="https://staging.example.test/admin"');
    expect(html).not.toContain("drdebayansaha.in");
  });

  it("defaults the dashboard link to the configured VITE_SITE_URL", () => {
    const { html } = buildAppointmentEmail(base);
    expect(html).toContain(`href="${publicEnv.siteUrl}/admin"`);
  });

  it("ignores any path on the supplied origin and keeps the link on /admin", () => {
    const { html } = buildAppointmentEmail(base, "https://example.test/some/path/");
    expect(html).toContain('href="https://example.test/admin"');
  });
});
