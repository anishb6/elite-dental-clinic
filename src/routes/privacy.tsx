import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/layout/page-hero";
import { SiteLayout } from "@/components/layout/site-layout";
import { CLINIC } from "@/config/site";
import { buildPageHead } from "@/lib/seo";

export const Route = createFileRoute("/privacy")({
  head: () =>
    buildPageHead({
      path: "/privacy",
      title: "Privacy Notice (Draft) | Elite Dental Clinic Barasat",
      description: "Information on how patient data is handled at Elite Dental Clinic, Barasat.",
      ogTitle: "Privacy Notice | Elite Dental Clinic",
      ogDescription: "Patient data handling, retention, and privacy information.",
    }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Privacy"
        title="Patient Privacy Notice"
        text="How we protect and manage your personal and appointment information."
      />
      <section className="mx-auto max-w-4xl px-6 py-16 text-foreground">
        <div className="rounded-lg border border-amber-300 bg-amber-50/50 p-4 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <strong>Draft Notice:</strong> This privacy document is an initial operational draft
          prepared for Elite Dental Clinic and is subject to formal review, revision, and
          confirmation by {CLINIC.doctor} and qualified legal counsel to ensure complete alignment
          with the Digital Personal Data Protection (DPDP) Act, 2023, and applicable Indian
          healthcare regulations.
        </div>

        <div className="mt-8 space-y-8 text-base leading-relaxed text-muted-foreground">
          <div>
            <h2 className="text-xl font-serif font-bold text-foreground">1. Data Controller</h2>
            <p className="mt-2">
              Elite Dental Clinic, operated by {CLINIC.doctor}, located at {CLINIC.address}. For
              questions regarding this notice or your personal information, contact us via phone at{" "}
              {CLINIC.phone}.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-serif font-bold text-foreground">
              2. Information We Collect
            </h2>
            <p className="mt-2">
              We collect only the minimum necessary information required to facilitate and schedule
              dental appointments:
            </p>
            <ul className="mt-2 list-disc pl-6 space-y-1">
              <li>
                <strong>Contact Details:</strong> Your full name, telephone number, and optional
                email address.
              </li>
              <li>
                <strong>Appointment Preferences:</strong> Preferred appointment date and time slot
                (Morning, Afternoon, Evening).
              </li>
              <li>
                <strong>Optional Clinical Notes:</strong> Any voluntary notes you choose to share
                regarding your dental concern or treatment request.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-serif font-bold text-foreground">
              3. Purpose and Legal Basis
            </h2>
            <p className="mt-2">
              Your contact details are processed strictly for the following purposes:
            </p>
            <ul className="mt-2 list-disc pl-6 space-y-1">
              <li>
                Contacting you by telephone or WhatsApp to confirm your dental consultation slot.
              </li>
              <li>Coordinating clinical appointment schedules.</li>
              <li>Internal clinic operational notifications.</li>
            </ul>
            <p className="mt-2 font-medium text-foreground">
              We do NOT sell, rent, or trade your personal information to third-party advertisers or
              data brokers for marketing campaigns.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-serif font-bold text-foreground">
              4. Data Storage & Security Measures
            </h2>
            <p className="mt-2">
              Appointment records are stored in a secured Supabase PostgreSQL database protected by
              strict Row Level Security (RLS) policies. Direct public browser access is completely
              revoked; records are accessed only through trusted server-side authentication by
              authorized clinic staff. Clinical health notes are accessible strictly within the
              password-protected staff portal and are omitted from all notification emails and
              routine application logs.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-serif font-bold text-foreground">
              5. Data Retention & Patient Rights
            </h2>
            <p className="mt-2">
              Appointment requests are retained as active scheduling records and subsequently
              archived in accordance with healthcare record retention guidelines. Under the Digital
              Personal Data Protection (DPDP) Act, 2023, patients have the right to request access
              to their personal data, request correction of inaccurate records, or request
              withdrawal of consent and erasure where ongoing retention is not legally mandated.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-serif font-bold text-foreground">
              6. Consent and Affirmation
            </h2>
            <p className="mt-2">
              By ticking the consent box on our online booking form, you affirm that you voluntarily
              provide your contact details to Elite Dental Clinic for appointment coordination.
            </p>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
