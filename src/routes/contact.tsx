import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout, PageHero } from "@/components/SiteLayout";
import { CLINIC } from "@/lib/clinic";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact | Elite Dental Clinic Barasat" },
      { name: "description", content: "Address, phone, opening hours and map for Elite Dental Clinic, Barasat." },
      { property: "og:title", content: "Contact Elite Dental Clinic Barasat" },
      { property: "og:description", content: "Find us, call us or message us on WhatsApp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Contact,
});

function Contact() {
  return (
    <SiteLayout>
      <PageHero eyebrow="Contact" title="Visit us in Barasat." />
      <section className="mx-auto max-w-7xl px-6 py-24 grid gap-14 md:grid-cols-2">
        <div className="space-y-8">
          <div><p className="eyebrow">Address</p><p className="mt-2 text-xl">{CLINIC.address}</p></div>
          <div><p className="eyebrow">Phone</p><a href={CLINIC.phoneHref} className="mt-2 block text-xl">{CLINIC.phone}</a><p className="mt-1 text-sm text-muted-foreground">Calls &amp; WhatsApp</p></div>
          <div>
            <p className="eyebrow">Hours</p>
            {CLINIC.hours.map(([d, h]) => <p key={d} className="mt-2">{d}: {h}</p>)}
          </div>
          <div className="flex flex-wrap gap-4">
            <a href={`https://wa.me/${CLINIC.whatsapp}`} target="_blank" rel="noreferrer" className="btn-gold">WhatsApp us</a>
            <Link to="/book" className="btn-outline">Book appointment</Link>
          </div>
        </div>
        <iframe
          title="Map to Elite Dental Clinic, Nabapally, Barasat"
          src={`https://www.google.com/maps?q=${CLINIC.mapQuery}&output=embed`}
          className="w-full min-h-[400px] border-0"
          loading="lazy"
        />
      </section>
    </SiteLayout>
  );
}
