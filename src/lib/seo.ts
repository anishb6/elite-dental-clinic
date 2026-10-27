/**
 * Builds the per-route `<head>` metadata that every page repeats
 * (title, description, canonical URL, Open Graph, Twitter card).
 */
import { publicEnv } from "@/config/env.public";
import { CLINIC, type IndexablePath } from "@/config/site";

export type MetaTag =
  { title: string } | { name: string; content: string } | { property: string; content: string };

export type LinkTag = { rel: "canonical"; href: string };

export type PageSeo = {
  /** Path of this page; the canonical URL and `og:url` are derived from it. */
  path: IndexablePath;
  title: string;
  description: string;
  /** Falls back to `title` / `description` when omitted. */
  ogTitle?: string;
  ogDescription?: string;
};

/** Absolute URL on the production origin for a site path (`/about` -> `https://…/about`). */
export function absoluteUrl(path: string, origin: string = publicEnv.siteUrl): string {
  return new URL(path, `${origin}/`).href;
}

/** Structured Data (JSON-LD) for Dentist and LocalBusiness. */
export function buildClinicStructuredData(
  origin: string = publicEnv.siteUrl,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": ["Dentist", "MedicalBusiness", "LocalBusiness"],
    name: CLINIC.name,
    description:
      "Modern, gentle dental care in Barasat by Dr. Debayan Saha (B.D.S., Stomatologist).",
    url: absoluteUrl("/", origin),
    telephone: CLINIC.phone,
    medicalSpecialty: "Dentistry",
    address: {
      "@type": "PostalAddress",
      streetAddress:
        "Sree Durga Apartment, near Nabapally Co-operative Bank, opposite Modern Homeo Hall, Bijaylakshmi Colony, Chakravartipara, Nabapally",
      addressLocality: "Barasat, Kolkata",
      addressRegion: "West Bengal",
      postalCode: "700126",
      addressCountry: "IN",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 22.7249436,
      longitude: 88.4745912,
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        opens: "10:30",
        closes: "13:30",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        opens: "18:00",
        closes: "21:00",
      },
    ],
    priceRange: "₹₹",
    founder: {
      "@type": "Person",
      name: CLINIC.doctor,
      jobTitle: "Dentist & Stomatologist",
      honorificPrefix: "Dr.",
    },
  };
}

export function buildPageHead({ path, title, description, ogTitle, ogDescription }: PageSeo): {
  meta: MetaTag[];
  links: LinkTag[];
} {
  const url = absoluteUrl(path);
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: ogTitle ?? title },
      { property: "og:description", content: ogDescription ?? description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}
