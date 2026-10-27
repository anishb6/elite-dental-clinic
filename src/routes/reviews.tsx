import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/layout/page-hero";
import { SiteLayout } from "@/components/layout/site-layout";
import { ReviewCard } from "@/features/clinic/components/review-card";
import { REVIEWS } from "@/features/clinic/data/reviews";
import { buildPageHead } from "@/lib/seo";

export const Route = createFileRoute("/reviews")({
  head: () =>
    buildPageHead({
      path: "/reviews",
      title: "Patient Reviews | Elite Dental Clinic Barasat",
      description: "What patients say about Dr. Debayan Saha and Elite Dental Clinic in Barasat.",
      ogTitle: "Patient Reviews | Elite Dental Clinic",
      ogDescription: "Stories from our patients in Barasat.",
    }),
  component: ReviewsPage,
});

function ReviewsPage() {
  return (
    <SiteLayout>
      <PageHero eyebrow="Reviews" title="Kind words from our patients." />
      <section className="mx-auto max-w-7xl px-6 py-24 grid gap-12 md:grid-cols-2 lg:grid-cols-3">
        {REVIEWS.map((review) => (
          <ReviewCard key={review.name} review={review} />
        ))}
      </section>
      <div className="pb-24 text-center">
        <Link to="/book" className="btn-gold">
          Book your visit
        </Link>
      </div>
    </SiteLayout>
  );
}
