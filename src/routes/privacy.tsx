import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/layout/page-hero";
import { SiteLayout } from "@/components/layout/site-layout";
import { CLINIC } from "@/config/site";
import { buildPageHead } from "@/lib/seo";

export const Route = createFileRoute("/privacy")({
  head: () =>
    buildPageHead({
      path: "/privacy",
      title: "Privacy Notice | Elite Dental Clinic Barasat",
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
        <p className="text-xs text-muted-foreground">Last updated: 31 October 2026</p>

        <div className="mt-6 space-y-8 text-base leading-relaxed text-muted-foreground">
          <div>
            <h2 className="text-xl font-serif font-bold text-foreground">1. Data Controller</h2>
            <p className="mt-2">
              Elite Dental Clinic, operated by {CLINIC.doctor}, located at {CLINIC.address}. For
              questions about this notice or your personal information, or to make a request
              described in section 6, email{" "}
              <a className="underline hover:text-foreground" href={`mailto:${CLINIC.privacyEmail}`}>
                {CLINIC.privacyEmail}
              </a>{" "}
              or call {CLINIC.phone}.
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
              5. Service Providers and Analytics
            </h2>
            <p className="mt-2">
              We use a small number of service providers to run this website. They handle data only
              to provide their service to us:
            </p>
            <ul className="mt-2 list-disc pl-6 space-y-1">
              <li>
                <strong>Supabase</strong> stores appointment records (database and staff login).
              </li>
              <li>
                <strong>Resend</strong> delivers the booking alert email to the clinic. The email
                contains your name, phone, optional email, preferred date and time, and how you
                found us. It does not contain your clinical notes.
              </li>
              <li>
                <strong>Cloudflare</strong> hosts the website and provides Turnstile, a bot check on
                the booking form.
              </li>
              <li>
                <strong>Google Analytics</strong> measures how visitors use the site (pages viewed
                and actions such as tapping Call, WhatsApp or the booking button). It uses cookies
                or similar identifiers and receives technical data such as your approximate
                location, device and browser. We do not send your name, phone number, email address
                or notes to Google Analytics. When you submit a booking, only the chosen time slot
                and how you found us are recorded.
              </li>
            </ul>
            <p className="mt-2">
              Some of these providers may process data on servers outside India.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-serif font-bold text-foreground">
              6. Data Retention & Your Rights
            </h2>
            <p className="mt-2">
              Appointment information is retained only as long as necessary for booking
              administration, follow-up and applicable legal obligations. Records are securely
              deleted or anonymised when no longer required. The exact retention period is subject
              to confirmation against applicable legal requirements.
            </p>
            <p className="mt-2">
              Under the Digital Personal Data Protection (DPDP) Act, 2023, you may ask to access
              your personal data, request correction of inaccurate records, or withdraw your consent
              and request erasure where we are not legally required to keep it. Email{" "}
              <a className="underline hover:text-foreground" href={`mailto:${CLINIC.privacyEmail}`}>
                {CLINIC.privacyEmail}
              </a>{" "}
              and we will respond to your request.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-serif font-bold text-foreground">
              7. Consent and Affirmation
            </h2>
            <p className="mt-2">
              By ticking the consent box on our online booking form, you affirm that you voluntarily
              provide your contact details to Elite Dental Clinic for appointment coordination. We
              record the time you gave consent and the version of this notice you accepted. You can
              withdraw consent at any time using the contact details above.
            </p>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
