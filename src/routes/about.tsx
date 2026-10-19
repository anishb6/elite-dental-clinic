import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, PageHero } from "@/components/SiteLayout";
import { CLINIC } from "@/lib/clinic";
import { CLINIC_PHOTOS } from "@/lib/clinic-photos";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Dr. Debayan Saha | Elite Dental Clinic Barasat" },
      { name: "description", content: "Meet Dr. Debayan Saha and the Elite Dental Clinic team in Barasat — gentle, honest, modern dentistry." },
      { property: "og:title", content: "About Dr. Debayan Saha | Elite Dental Clinic" },
      { property: "og:description", content: "Gentle, honest, modern dentistry in Barasat." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: About,
});

const VALUES = [
  ["Gentle care", "Painless techniques and a calm environment for anxious patients."],
  ["Honest advice", "We explain every option and only recommend what you need."],
  ["Strict hygiene", "Sterilised instruments and international infection-control standards."],
  ["Modern equipment", "Up-to-date tools for faster, more comfortable treatment."],
];

function About() {
  return (
    <SiteLayout>
      <PageHero eyebrow="About" title={`${CLINIC.doctor}`} text="Caring dentistry for every member of your family in Barasat." />
      <section className="mx-auto max-w-7xl px-6 py-24 grid gap-14 md:grid-cols-2">
        <img src={CLINIC_PHOTOS[0].src} alt={CLINIC_PHOTOS[0].alt} loading="lazy" width={1448} height={1086} className="w-full rounded-sm" />
        <div className="space-y-6 text-lg text-muted-foreground">
          <p className="eyebrow">My story</p>
          <p>{CLINIC.doctor} founded Elite Dental Clinic to give Barasat a dental practice that feels both premium and personal — where treatment is explained clearly and patients never feel rushed.</p>
          <p>From children's first checkups to complex root canals and smile makeovers, every treatment is delivered with patience and precision.</p>
          <div className="border-l-2 border-gold pl-5 text-foreground">
            <p className="font-semibold">Qualifications</p>
            <p className="text-sm text-muted-foreground">{CLINIC.qualifications}</p>
            <p className="mt-2 text-sm text-muted-foreground">{CLINIC.background}</p>
          </div>
        </div>
      </section>
      <section className="bg-secondary py-24">
        <div className="mx-auto max-w-7xl px-6 grid gap-14 md:grid-cols-2 items-center">
          <div className="grid gap-8 sm:grid-cols-2">
            {VALUES.map(([t, d]) => (
              <div key={t}>
                <h3 className="text-2xl">{t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
          <img src={CLINIC_PHOTOS[1].src} alt={CLINIC_PHOTOS[1].alt} loading="lazy" width={1600} height={1200} className="w-full rounded-sm" />
        </div>
      </section>
    </SiteLayout>
  );
}
