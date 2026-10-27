import { publicEnv } from "@/config/env.public";
import type { AppointmentPayload } from "../schemas";

/** Escape user-supplied text before embedding it in HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Builds the clinic notification email.
 *
 * Privacy Hardening:
 * To safeguard patient health confidentiality and comply with data minimization
 * best practices (including DPDP Act standards), raw health complaints/messages
 * are not transmitted over unencrypted email. The email indicates whether a note
 * was attached, and directs clinic staff to the secure authenticated Admin Dashboard.
 */
export function buildAppointmentEmail(
  data: AppointmentPayload,
  /** Site origin for the dashboard link. Defaults to the configured `VITE_SITE_URL`. */
  siteUrl: string = publicEnv.siteUrl,
): { subject: string; html: string } {
  const adminUrl = new URL("/admin", siteUrl).toString();
  const rows: [label: string, value: string][] = [
    ["Name", data.name],
    ["Phone", data.phone],
    ["Email", data.email || "—"],
    ["Preferred date", data.preferred_date],
    ["Preferred time", data.preferred_time],
    ["How they found us", data.source || "—"],
    ["Clinical notes", data.message ? "Yes (confidential — view in staff portal)" : "None"],
  ];

  const html =
    `<h2>New appointment request</h2>` +
    `<table cellpadding="6" style="border-collapse: collapse; width: 100%; max-width: 500px;">` +
    rows
      .map(
        ([label, value]) =>
          `<tr style="border-bottom: 1px solid #e5e7eb;"><td style="font-weight: bold; width: 150px;">${label}</td><td>${escapeHtml(value)}</td></tr>`,
      )
      .join("") +
    `</table>` +
    `<p style="margin-top: 16px;">Call the patient to confirm their appointment slot.</p>` +
    `<p style="margin-top: 12px;"><a href="${escapeHtml(adminUrl)}" style="display: inline-block; padding: 8px 16px; background-color: #0f172a; color: #ffffff; text-decoration: none; border-radius: 4px; font-size: 14px;">Open Staff Admin Dashboard</a></p>` +
    `<p style="font-size: 12px; color: #6b7280; margin-top: 8px;">Detailed medical notes and appointment records are kept in the staff dashboard to protect patient privacy.</p>`;

  // Strip CR/LF so a crafted name can't inject extra e-mail headers.
  const subject = `New appointment request – ${data.name.replace(/[\r\n]/g, " ")}`;
  return { subject, html };
}
