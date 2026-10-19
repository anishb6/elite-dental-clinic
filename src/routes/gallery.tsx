import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, PageHero } from "@/components/SiteLayout";
import { CLINIC_PHOTOS, TREATMENT_PHOTOS } from "@/lib/clinic-photos";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Smile Gallery | Elite Dental Clinic Barasat" },
      { name: "description", content: "See smile results and take a look inside Elite Dental Clinic in Barasat." },
      { property: "og:title", content: "Smile Gallery | Elite Dental Clinic" },
      { property: "og:description", content: "Smile results and our modern clinic in Barasat." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Gallery,
});

function Gallery() {
  return (
    <SiteLayout>
      <PageHero eyebrow="Gallery" title="Smiles & spaces." text="Patient treatment results and a look inside Elite Dental Clinic, Barasat." />
      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="mb-8 text-4xl">Inside our clinic</h2>
        <div className="grid gap-6 md:grid-cols-2">
        {CLINIC_PHOTOS.map((it) => (
          <figure key={it.src} className="overflow-hidden bg-card">
            <img src={it.src} alt={it.alt} loading="lazy" width={1600} height={1200} className="aspect-[4/3] w-full object-contain" />
            <figcaption className="p-4 eyebrow">{it.label}</figcaption>
          </figure>
        ))}
        </div>
      </section>
      <section className="bg-secondary py-16">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="mb-8 text-4xl">Treatment results</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TREATMENT_PHOTOS.map((it) => (
              <figure key={it.src} className="overflow-hidden bg-card">
                <img src={it.src} alt={it.alt} loading="lazy" width={1213} height={1600} className="aspect-[1213/1600] w-full object-contain" />
                <figcaption className="p-4 eyebrow">{it.label}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
