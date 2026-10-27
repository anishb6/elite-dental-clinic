import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/layout/page-hero";
import { SiteLayout } from "@/components/layout/site-layout";
import { PhotoFigure } from "@/features/clinic/components/photo-figure";
import { CLINIC_PHOTOS, TREATMENT_PHOTOS } from "@/features/clinic/data/photos";
import { buildPageHead } from "@/lib/seo";

export const Route = createFileRoute("/gallery")({
  head: () =>
    buildPageHead({
      path: "/gallery",
      title: "Smile Gallery | Elite Dental Clinic Barasat",
      description: "See smile results and take a look inside Elite Dental Clinic in Barasat.",
      ogTitle: "Smile Gallery | Elite Dental Clinic",
      ogDescription: "Smile results and our modern clinic in Barasat.",
    }),
  component: GalleryPage,
});

function GalleryPage() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Gallery"
        title="Smiles & spaces."
        text="Patient treatment results and a look inside Elite Dental Clinic, Barasat."
      />
      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="mb-8 text-4xl">Inside our clinic</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {CLINIC_PHOTOS.map((photo) => (
            <PhotoFigure
              key={photo.src}
              photo={photo}
              width={1600}
              height={1200}
              aspectClass="aspect-[4/3]"
            />
          ))}
        </div>
      </section>
      <section className="bg-secondary py-16">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="mb-8 text-4xl">Treatment results</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TREATMENT_PHOTOS.map((photo) => (
              <PhotoFigure
                key={photo.src}
                photo={photo}
                width={1213}
                height={1600}
                aspectClass="aspect-[1213/1600]"
              />
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
