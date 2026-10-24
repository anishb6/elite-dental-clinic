import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(6).max(20),
  email: z.string().trim().max(255).nullable().optional(),
  treatment: z.string().min(1).max(100),
  preferred_date: z.string().min(1).max(20),
  preferred_time: z.string().min(1).max(20),
  message: z.string().trim().max(1000).nullable().optional(),
  source: z.string().max(40).nullable().optional(),
});

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const Route = createFileRoute("/api/notify-appointment")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["RESEND_API_KEY"];
        const to = process.env["NOTIFY_EMAIL"];
        const from = process.env["NOTIFY_FROM"] || "Website Bookings <onboarding@resend.dev>";
        if (!apiKey || !to) {
          console.error("[notify] Missing RESEND_API_KEY or NOTIFY_EMAIL");
          return Response.json({ ok: false }, { status: 500 });
        }

        let parsed;
        try {
          parsed = schema.safeParse(await request.json());
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }
        if (!parsed.success) return Response.json({ ok: false }, { status: 400 });
        const d = parsed.data;

        const rows: [string, string][] = [
          ["Name", d.name],
          ["Phone", d.phone],
          ["Email", d.email || "—"],
          ["Treatment", d.treatment],
          ["Preferred date", d.preferred_date],
          ["Preferred time", d.preferred_time],
          ["How they found us", d.source || "—"],
          ["Message", d.message || "—"],
        ];
        const html =
          `<h2>New appointment request</h2><table cellpadding="6">` +
          rows.map(([k, v]) => `<tr><td><b>${k}</b></td><td>${esc(v)}</td></tr>`).join("") +
          `</table><p>Call the patient to confirm.</p>`;

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to: to.split(",").map((s) => s.trim()),
            subject: `New appointment request – ${d.name.replace(/[\r\n]/g, " ")}`,
            html,
          }),
        });
        if (!res.ok) {
          console.error("[notify] Resend error", res.status, await res.text());
          return Response.json({ ok: false }, { status: 502 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
