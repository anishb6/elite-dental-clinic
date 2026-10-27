import { Link } from "@tanstack/react-router";
import { CLINIC } from "@/config/site";

export function CtaBanner() {
  return (
    <section className="bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-6 py-16 flex flex-col md:flex-row gap-6 items-center justify-between">
        <h2 className="text-4xl md:text-5xl">Ready for a healthier smile?</h2>
        <div className="flex flex-wrap gap-4">
          <a href={CLINIC.phoneHref} className="btn-outline">
            Call {CLINIC.phone}
          </a>
          <a
            href={CLINIC.whatsappBookHref}
            target="_blank"
            rel="noreferrer"
            className="btn-outline"
          >
            Book on WhatsApp
          </a>
          <Link to="/book" className="btn-gold">
            Book Now
          </Link>
        </div>
      </div>
    </section>
  );
}
