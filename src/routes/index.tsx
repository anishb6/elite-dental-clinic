import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/layout/site-layout";
import { CtaBanner } from "@/features/home/components/cta-banner";
import { DoctorIntroSection } from "@/features/home/components/doctor-intro-section";
import { HeroSection } from "@/features/home/components/hero-section";
import { ServicesPreviewSection } from "@/features/home/components/services-preview-section";
import { TestimonialsSection } from "@/features/home/components/testimonials-section";
import { buildPageHead } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () =>
    buildPageHead({
      path: "/",
      title: "Elite Dental Clinic Barasat | Dr. Debayan Saha, Dentist",
      description:
        "Painless root canal, teeth cleaning, whitening, kids' dentistry and emergency dental care in Barasat by Dr. Debayan Saha.",
      ogTitle: "Elite Dental Clinic Barasat | Dr. Debayan Saha",
      ogDescription: "Modern, gentle dental care in Barasat. Book your appointment today.",
    }),
  component: HomePage,
});

function HomePage() {
  return (
    <SiteLayout>
      <HeroSection />
      <DoctorIntroSection />
      <ServicesPreviewSection />
      <TestimonialsSection />
      <CtaBanner />
    </SiteLayout>
  );
}
