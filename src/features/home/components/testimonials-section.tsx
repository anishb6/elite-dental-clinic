import { ReviewCard } from "@/features/clinic/components/review-card";
import { REVIEWS } from "@/features/clinic/data/reviews";

const FEATURED_COUNT = 3;

export function TestimonialsSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <p className="eyebrow">Patient stories</p>
      <div className="mt-10 grid gap-10 md:grid-cols-3">
        {REVIEWS.slice(0, FEATURED_COUNT).map((review) => (
          <ReviewCard key={review.name} review={review} />
        ))}
      </div>
    </section>
  );
}
