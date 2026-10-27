import { Link } from "@tanstack/react-router";
import { ServiceCard } from "@/features/clinic/components/service-card";
import { SERVICES } from "@/features/clinic/data/services";

const PREVIEW_COUNT = 6;

export function ServicesPreviewSection() {
  return (
    <section className="bg-secondary py-24">
      <div className="mx-auto max-w-7xl px-6">
        <p className="eyebrow">Treatments</p>
        <h2 className="mt-4 text-4xl md:text-6xl">Complete care, one clinic.</h2>
        <div className="mt-12 grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.slice(0, PREVIEW_COUNT).map((service) => (
            <ServiceCard key={service.name} service={service} />
          ))}
        </div>
        <Link to="/services" className="btn-gold mt-10">
          View all {SERVICES.length} treatments
        </Link>
      </div>
    </section>
  );
}
