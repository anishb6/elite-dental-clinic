import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout, PageHero } from "@/components/SiteLayout";
import { REVIEWS } from "@/lib/clinic";

export const Route = createFileRoute("/reviews")({
  head: () => ({
    meta: [
      { title: "Patient Reviews | Elite Dental Clinic Barasat" },
      { name: "description", content: "What patients say about Dr. Debayan Saha and Elite Dental Clinic in Barasat." },
      { property: "og:title", content: "Patient Reviews | Elite Dental Clinic" },
      { property: "og:description", content: "Stories from our patients in Barasat." },
    ],
  }),
  component: Reviews,
});

function Reviews() {
  return (
    <SiteLayout>
      <PageHero eyebrow="Reviews" title="Kind words from our patients." />
      <section className="mx-auto max-w-7xl px-6 py-24 grid gap-12 md:grid-cols-2 lg:grid-cols-3">
        {REVIEWS.map((r, i) => (
          <blockquote key={i} className="border-t-2 border-gold pt-6">
            <p className="text-gold tracking-widest">★★★★★</p>
            <p className="mt-3 font-serif text-2xl leading-snug">"{r.text}"</p>
            <footer className="mt-4 text-sm text-muted-foreground">{r.treatment}</footer>
          </blockquote>
        ))}
      </section>
      <div className="pb-24 text-center"><Link to="/book" className="btn-gold">Book your visit</Link></div>
    </SiteLayout>
  );
}
