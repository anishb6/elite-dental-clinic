import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, PageHero } from "@/components/SiteLayout";
import hero from "@/assets/hero.jpg";
import reception from "@/assets/reception.jpg";
import smile from "@/assets/smile.jpg";
import doctor from "@/assets/doctor.jpg";

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

const ITEMS = [
  { src: smile, alt: "Smile result after whitening", label: "Smile result" },
  { src: hero, alt: "Treatment room", label: "Treatment room" },
  { src: reception, alt: "Reception area", label: "Reception" },
  { src: doctor, alt: "Dr. Debayan Saha", label: "Dr. Debayan Saha" },
];

function Gallery() {
  return (
    <SiteLayout>
      <PageHero eyebrow="Gallery" title="Smiles & spaces." text="Before-and-after results and a look inside our clinic. More real patient results coming soon." />
      <section className="mx-auto max-w-7xl px-6 py-24 grid gap-6 md:grid-cols-2">
        {ITEMS.map((it) => (
          <figure key={it.label} className="group overflow-hidden bg-card">
            <img src={it.src} alt={it.alt} loading="lazy" className="aspect-[5/4] w-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <figcaption className="p-4 eyebrow">{it.label}</figcaption>
          </figure>
        ))}
      </section>
    </SiteLayout>
  );
}
