import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/layout/page-hero";
import { SiteLayout } from "@/components/layout/site-layout";
import { CLINIC } from "@/config/site";
import { ValuesGrid } from "@/features/about/components/values-grid";
import { ABOUT_PHOTO, DOCTOR_PHOTO } from "@/features/clinic/data/photos";
import { buildPageHead } from "@/lib/seo";

export const Route = createFileRoute("/about")({
  head: () =>
    buildPageHead({
      path: "/about",
      title: "About Dr. Debayan Saha | Elite Dental Clinic Barasat",
      description:
        "Meet Dr. Debayan Saha and the Elite Dental Clinic team in Barasat — gentle, honest, modern dentistry.",
      ogTitle: "About Dr. Debayan Saha | Elite Dental Clinic",
      ogDescription: "Gentle, honest, modern dentistry in Barasat.",
    }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="About"
        title={CLINIC.doctor}
        text="Caring dentistry for every member of your family in Barasat."
      />
      <section className="mx-auto max-w-7xl px-6 py-24 grid gap-14 md:grid-cols-2">
        <img
          src={DOCTOR_PHOTO.src}
          alt={DOCTOR_PHOTO.alt}
          loading="lazy"
          width={900}
          height={1200}
          className="mx-auto aspect-[3/4] w-full max-w-md rounded-sm object-cover object-top"
        />
        <div className="space-y-6 text-lg text-muted-foreground">
          <p className="eyebrow">My story</p>
          <p>
            {CLINIC.doctor} founded Elite Dental Clinic to give Barasat a dental practice that feels
            both premium and personal — where treatment is explained clearly and patients never feel
            rushed.
          </p>
          <p>
            From children's first checkups to complex root canals and smile makeovers, every
            treatment is delivered with patience and precision.
          </p>
          <div className="border-l-2 border-gold pl-5 text-foreground">
            <p className="font-semibold">Qualifications</p>
            <p className="text-sm text-muted-foreground">{CLINIC.qualifications}</p>
            <p className="mt-2 text-sm text-muted-foreground">{CLINIC.background}</p>
          </div>
        </div>
      </section>
      <section className="bg-secondary py-24">
        <div className="mx-auto max-w-7xl px-6 grid gap-14 md:grid-cols-2 items-center">
          <ValuesGrid />
          <img
            src={ABOUT_PHOTO.src}
            alt={ABOUT_PHOTO.alt}
            loading="lazy"
            width={1600}
            height={1200}
            className="w-full rounded-sm"
          />
        </div>
      </section>
    </SiteLayout>
  );
}
