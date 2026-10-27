import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/layout/page-hero";
import { SiteLayout } from "@/components/layout/site-layout";
import { ServiceCard } from "@/features/clinic/components/service-card";
import { SERVICES } from "@/features/clinic/data/services";
import { buildPageHead } from "@/lib/seo";

export const Route = createFileRoute("/services")({
  head: () =>
    buildPageHead({
      path: "/services",
      title: "Dental Treatments in Barasat | Elite Dental Clinic",
      description:
        "Root canal, teeth cleaning, fillings, extraction, crowns, whitening, gum treatment, dentures, kids' and emergency dentistry in Barasat.",
      ogTitle: "Dental Treatments | Elite Dental Clinic Barasat",
      ogDescription: `${SERVICES.length} dental treatments under one roof, by Dr. Debayan Saha.`,
    }),
  component: ServicesPage,
});

function ServicesPage() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Services"
        title="Every treatment your smile needs."
        text="From routine checkups to emergency care — all under one roof in Barasat."
      />
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service, index) => (
            <ServiceCard key={service.name} service={service} index={index} />
          ))}
        </div>
        <div className="mt-14 text-center">
          <Link to="/book" className="btn-gold">
            Book a consultation
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}
