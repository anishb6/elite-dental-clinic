import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";
import { CLINIC, SERVICES, REVIEWS } from "@/lib/clinic";
import { CLINIC_PHOTOS } from "@/lib/clinic-photos";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Elite Dental Clinic Barasat | Dr. Debayan Saha, Dentist" },
      { name: "description", content: "Painless root canal, teeth cleaning, whitening, kids' dentistry and emergency dental care in Barasat by Dr. Debayan Saha." },
      { property: "og:title", content: "Elite Dental Clinic Barasat | Dr. Debayan Saha" },
      { property: "og:description", content: "Modern, gentle dental care in Barasat. Book your appointment today." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <SiteLayout>
      <section className="relative bg-primary text-primary-foreground overflow-hidden">
        <img src={CLINIC_PHOTOS[0].src} alt={CLINIC_PHOTOS[0].alt} width={1448} height={1086} className="absolute inset-0 h-full w-full object-cover opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/80 to-transparent" />
        <div className="relative mx-auto max-w-7xl px-6 py-28 md:py-40">
          <p className="eyebrow">Dentist in {CLINIC.city}</p>
          <h1 className="mt-5 text-5xl md:text-8xl max-w-3xl leading-[0.95]">Your smile, in expert hands.</h1>
          <p className="mt-6 max-w-xl text-lg opacity-80">Gentle, modern dental care by {CLINIC.doctor} — from routine checkups to painless root canals and smile makeovers.</p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link to="/book" className="btn-gold">Book Appointment</Link>
            <Link to="/services" className="btn-outline">Our Treatments</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-24 grid gap-14 md:grid-cols-2 items-center">
        <img src={CLINIC_PHOTOS[0].src} alt={CLINIC_PHOTOS[0].alt} loading="lazy" width={1448} height={1086} className="w-full rounded-sm shadow-2xl" />
        <div>
          <p className="eyebrow">Meet your dentist</p>
          <h2 className="mt-4 text-4xl md:text-6xl">{CLINIC.doctor}</h2>
          <p className="mt-6 text-lg text-muted-foreground">Every patient deserves to feel calm, heard and cared for. At Elite Dental Clinic we combine modern equipment with an unhurried, honest approach — so you always understand your treatment.</p>
          <Link to="/about" className="btn-outline mt-8">About the clinic</Link>
        </div>
      </section>

      <section className="bg-secondary py-24">
        <div className="mx-auto max-w-7xl px-6">
          <p className="eyebrow">Treatments</p>
          <h2 className="mt-4 text-4xl md:text-6xl">Complete care, one clinic.</h2>
          <div className="mt-12 grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.slice(0, 6).map((s) => (
              <div key={s.name} className="bg-card p-8">
                <h3 className="text-2xl">{s.name}</h3>
                <p className="mt-3 text-sm text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
          <Link to="/services" className="btn-gold mt-10">View all 15 treatments</Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-24">
        <p className="eyebrow">Patient stories</p>
        <div className="mt-10 grid gap-10 md:grid-cols-3">
          {REVIEWS.slice(0, 3).map((r) => (
            <blockquote key={r.name} className="min-w-0 border-t-2 border-gold pt-6">
              <p className="font-serif text-2xl leading-snug">"{r.text}"</p>
              <footer className="mt-4 text-sm font-semibold text-muted-foreground">— {r.name}</footer>
            </blockquote>
          ))}
        </div>
      </section>

      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-7xl px-6 py-16 flex flex-col md:flex-row gap-6 items-center justify-between">
          <h2 className="text-4xl md:text-5xl">Ready for a healthier smile?</h2>
          <div className="flex gap-4">
            <a href={CLINIC.phoneHref} className="btn-outline">Call {CLINIC.phone}</a>
            <Link to="/book" className="btn-gold">Book Now</Link>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
