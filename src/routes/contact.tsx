import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/layout/page-hero";
import { SiteLayout } from "@/components/layout/site-layout";
import { CLINIC, OPENING_HOURS } from "@/config/site";
import { buildPageHead } from "@/lib/seo";

export const Route = createFileRoute("/contact")({
  head: () =>
    buildPageHead({
      path: "/contact",
      title: "Contact | Elite Dental Clinic Barasat",
      description: "Address, phone, opening hours and map for Elite Dental Clinic, Barasat.",
      ogTitle: "Contact Elite Dental Clinic Barasat",
      ogDescription: "Find us, call us or message us on WhatsApp.",
    }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <SiteLayout>
      <PageHero eyebrow="Contact" title="Visit us in Barasat." />
      <section className="mx-auto max-w-7xl px-6 py-24 grid gap-14 md:grid-cols-2">
        <div className="space-y-8">
          <div>
            <p className="eyebrow">Address</p>
            <p className="mt-2 text-xl">{CLINIC.address}</p>
          </div>
          <div>
            <p className="eyebrow">Phone</p>
            <a href={CLINIC.phoneHref} className="mt-2 block text-xl">
              {CLINIC.phone}
            </a>
            <p className="mt-1 text-sm text-muted-foreground">Calls &amp; WhatsApp</p>
          </div>
          <div>
            <p className="eyebrow">Hours</p>
            {OPENING_HOURS.map(({ days, time }) => (
              <p key={days} className="mt-2">
                {days}: {time}
              </p>
            ))}
          </div>
          <div className="flex flex-wrap gap-4">
            <a href={CLINIC.whatsappHref} target="_blank" rel="noreferrer" className="btn-gold">
              WhatsApp us
            </a>
            <Link to="/book" className="btn-outline">
              Book appointment
            </Link>
          </div>
        </div>
        <div className="space-y-2">
          <iframe
            title="Map to Elite Dental Clinic, Nabapally, Barasat"
            src={`https://www.google.com/maps?q=${CLINIC.mapCoords}&z=17&output=embed`}
            className="w-full min-h-[400px] border-0"
            loading="lazy"
          />
          <a
            href={CLINIC.mapsShareLink}
            target="_blank"
            rel="noreferrer"
            className="text-sm underline underline-offset-4 hover:text-gold"
          >
            Open directions in Google Maps ↗
          </a>
        </div>
      </section>
    </SiteLayout>
  );
}
