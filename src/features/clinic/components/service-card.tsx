import type { Service } from "../types";

type ServiceCardProps = {
  service: Service;
  /** Zero-based position; when provided the detailed (numbered) layout is used. */
  index?: number;
};

/** Compact card (home) or numbered full card (services page). */
export function ServiceCard({ service, index }: ServiceCardProps) {
  if (index === undefined) {
    return (
      <div className="bg-card p-8">
        <h3 className="text-2xl">{service.name}</h3>
        <p className="mt-3 text-sm text-muted-foreground">{service.text}</p>
      </div>
    );
  }
  return (
    <article className="bg-card p-8">
      <span className="font-serif text-gold text-xl">{String(index + 1).padStart(2, "0")}</span>
      <h2 className="mt-3 text-3xl">{service.name}</h2>
      <p className="mt-3 text-muted-foreground">{service.text}</p>
    </article>
  );
}
