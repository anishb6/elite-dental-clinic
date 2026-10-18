import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout, PageHero } from "@/components/SiteLayout";
import { SERVICES } from "@/lib/clinic";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Dental Treatments in Barasat | Elite Dental Clinic" },
      { name: "description", content: "Root canal, teeth cleaning, fillings, extraction, crowns, whitening, gum treatment, dentures, kids' and emergency dentistry in Barasat." },
      { property: "og:title", content: "Dental Treatments | Elite Dental Clinic Barasat" },
      { property: "og:description", content: "15 dental treatments under one roof, by Dr. Debayan Saha." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Services,
});

function Services() {
  return (
    <SiteLayout>
      <PageHero eyebrow="Services" title="Every treatment your smile needs." text="From routine checkups to emergency care — all under one roof in Barasat." />
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s, i) => (
            <article key={s.name} className="bg-card p-8">
              <span className="font-serif text-gold text-xl">{String(i + 1).padStart(2, "0")}</span>
              <h2 className="mt-3 text-3xl">{s.name}</h2>
              <p className="mt-3 text-muted-foreground">{s.text}</p>
            </article>
          ))}
        </div>
        <div className="mt-14 text-center">
          <Link to="/book" className="btn-gold">Book a consultation</Link>
        </div>
      </section>
    </SiteLayout>
  );
}
