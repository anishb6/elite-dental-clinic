import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, PageHero } from "@/components/SiteLayout";
import { CLINIC } from "@/lib/clinic";
import doctor from "@/assets/doctor.jpg";
import reception from "@/assets/reception.jpg";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Dr. Debayan Saha | Elite Dental Clinic Barasat" },
      { name: "description", content: "Meet Dr. Debayan Saha and the Elite Dental Clinic team in Barasat — gentle, honest, modern dentistry." },
      { property: "og:title", content: "About Dr. Debayan Saha | Elite Dental Clinic" },
      { property: "og:description", content: "Gentle, honest, modern dentistry in Barasat." },
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
        <img src={doctor} alt={CLINIC.doctor} loading="lazy" width={912} height={1104} className="w-full max-w-md rounded-sm" />
        <div className="space-y-6 text-lg text-muted-foreground">
          <p className="eyebrow">My story</p>
          <p>{CLINIC.doctor} founded Elite Dental Clinic to give Barasat a dental practice that feels both premium and personal — where treatment is explained clearly and patients never feel rushed.</p>
          <p>From children's first checkups to complex root canals and smile makeovers, every treatment is delivered with patience and precision.</p>
          <div className="border-l-2 border-gold pl-5 text-foreground">
            <p className="font-semibold">Qualifications</p>
            <p className="text-sm text-muted-foreground">BDS — details to be added</p>
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
          <img src={reception} alt="Elite Dental Clinic reception, Barasat" loading="lazy" width={1008} height={800} className="w-full rounded-sm" />
        </div>
      </section>
    </SiteLayout>
  );
}
