import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/layout/page-hero";
import { SiteLayout } from "@/components/layout/site-layout";
import { BookingForm } from "@/features/appointments/components/booking-form";
import { buildPageHead } from "@/lib/seo";

export const Route = createFileRoute("/book")({
  head: () =>
    buildPageHead({
      path: "/book",
      title: "Book a Dental Appointment | Elite Dental Clinic Barasat",
      description: "Request an appointment with Dr. Debayan Saha at Elite Dental Clinic, Barasat.",
      ogTitle: "Book an Appointment | Elite Dental Clinic",
      ogDescription: "Pick a date and time — we'll call to confirm.",
    }),
  component: BookPage,
});

function BookPage() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Appointments"
        title="Book your visit."
        text="Send a request and our team will call you to confirm your slot."
      />
      <section className="mx-auto max-w-3xl px-6 py-20">
        <BookingForm />
      </section>
    </SiteLayout>
  );
}
