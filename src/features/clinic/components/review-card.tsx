import type { Review } from "../types";

export function ReviewCard({ review }: { review: Review }) {
  return (
    <blockquote className="min-w-0 border-t-2 border-gold pt-6">
      <p className="font-serif text-2xl leading-snug break-words">“{review.text}”</p>
      <footer className="mt-5 text-sm font-semibold text-muted-foreground">— {review.name}</footer>
    </blockquote>
  );
}
