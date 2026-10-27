import { Link } from "@tanstack/react-router";
import { CLINIC } from "@/config/site";
import { HERO_PHOTO } from "@/features/clinic/data/photos";

export function HeroSection() {
  return (
    <section className="relative bg-primary text-primary-foreground overflow-hidden">
      <img
        src={HERO_PHOTO.src}
        alt={HERO_PHOTO.alt}
        width={1448}
        height={1086}
        className="absolute inset-0 h-full w-full object-cover opacity-35"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/80 to-transparent" />
      <div className="relative mx-auto max-w-7xl px-6 py-28 md:py-40">
        <p className="eyebrow">Dentist in {CLINIC.city}</p>
        <h1 className="mt-5 text-5xl md:text-8xl max-w-3xl leading-[0.95]">
          Your smile, in expert hands.
        </h1>
        <p className="mt-6 max-w-xl text-lg opacity-80">
          Gentle, modern dental care by {CLINIC.doctor} — from routine checkups to painless root
          canals and smile makeovers.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link to="/book" className="btn-gold">
            Book Appointment
          </Link>
          <a
            href={CLINIC.whatsappBookHref}
            target="_blank"
            rel="noreferrer"
            className="btn-outline"
          >
            Book on WhatsApp
          </a>
          <Link to="/services" className="btn-outline">
            Our Treatments
          </Link>
        </div>
      </div>
    </section>
  );
}
