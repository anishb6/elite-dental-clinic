import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { SiteLayout, PageHero } from "@/components/SiteLayout";
import { SERVICES } from "@/lib/clinic";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: "Book a Dental Appointment | Elite Dental Clinic Barasat" },
      { name: "description", content: "Request an appointment with Dr. Debayan Saha at Elite Dental Clinic, Barasat." },
      { property: "og:title", content: "Book an Appointment | Elite Dental Clinic" },
      { property: "og:description", content: "Pick a treatment and time — we'll call to confirm." },
    ],
  }),
  component: Book,
});

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(100),
  phone: z.string().trim().regex(/^[+\d\s-]{6,20}$/, "Please enter a valid phone number"),
  email: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
  treatment: z.string().min(1, "Choose a treatment").max(100),
  preferred_date: z.string().min(1, "Choose a date"),
  preferred_time: z.string().min(1, "Choose a time").max(20),
  message: z.string().trim().max(1000).optional(),
});

const field = "w-full border border-input bg-card px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring";

function Book() {
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const parsed = schema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setStatus("sending");
    const d = parsed.data;
    const { error } = await supabase.from("appointments").insert({
      ...d,
      email: d.email || null,
      message: d.message || null,
    });
    if (error) { setStatus("idle"); return setError("Something went wrong. Please call us instead."); }
    setStatus("done");
  }

  return (
    <SiteLayout>
      <PageHero eyebrow="Appointments" title="Book your visit." text="Send a request and our team will call you to confirm your slot." />
      <section className="mx-auto max-w-3xl px-6 py-20">
        {status === "done" ? (
          <div className="text-center border-t-2 border-gold pt-10">
            <h2 className="text-5xl">Thank you!</h2>
            <p className="mt-4 text-muted-foreground">Your request has been received. We'll call you shortly to confirm.</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2">
            <label className="sm:col-span-2 text-sm">Full name *<input name="name" className={field} maxLength={100} /></label>
            <label className="text-sm">Phone *<input name="phone" type="tel" className={field} maxLength={20} /></label>
            <label className="text-sm">Email<input name="email" type="email" className={field} maxLength={255} /></label>
            <label className="sm:col-span-2 text-sm">Treatment *
              <select name="treatment" className={field} defaultValue="">
                <option value="" disabled>Select a treatment</option>
                {SERVICES.map((s) => <option key={s.name}>{s.name}</option>)}
                <option>Not sure / Consultation</option>
              </select>
            </label>
            <label className="text-sm">Preferred date *<input name="preferred_date" type="date" min={new Date().toISOString().slice(0, 10)} className={field} /></label>
            <label className="text-sm">Preferred time *
              <select name="preferred_time" className={field} defaultValue="">
                <option value="" disabled>Select</option>
                <option>Morning</option><option>Afternoon</option><option>Evening</option>
              </select>
            </label>
            <label className="sm:col-span-2 text-sm">Message<textarea name="message" rows={4} className={field} maxLength={1000} /></label>
            {error && <p className="sm:col-span-2 text-destructive text-sm">{error}</p>}
            <button disabled={status === "sending"} className="btn-gold sm:col-span-2">
              {status === "sending" ? "Sending…" : "Request Appointment"}
            </button>
          </form>
        )}
      </section>
    </SiteLayout>
  );
}
