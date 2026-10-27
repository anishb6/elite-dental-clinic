/**
 * Static site configuration: clinic identity, contact details and navigation.
 * Content that is likely to change (phone, hours, address) lives here and
 * nowhere else - pages and components must read from `CLINIC`.
 */

const WHATSAPP_NUMBER = "919147718046";
const WHATSAPP_BOOKING_MESSAGE =
  "Hello Dr. Saha, I would like to book an appointment at Elite Dental Clinic.";

export const CLINIC = {
  name: "Elite Dental Clinic",
  doctor: "Dr. Debayan Saha",
  city: "Barasat",
  address:
    "Sree Durga Apartment, near Nabapally Co-operative Bank, opposite Modern Homeo Hall, Bijaylakshmi Colony, Chakravartipara, Nabapally, Barasat, Kolkata, West Bengal 700126",
  phone: "+91 91477 18046",
  phoneHref: "tel:+919147718046",
  whatsapp: WHATSAPP_NUMBER,
  whatsappHref: `https://wa.me/${WHATSAPP_NUMBER}`,
  whatsappBookHref: `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_BOOKING_MESSAGE)}`,
  qualifications: "B.D.S. (WBUHS), Stomatologist",
  background:
    "Formerly attached to the Dept. of General Medicine, College of Medicine & Sagore Dutta Hospital, Kamarhati",
  mapQuery:
    "Sree+Durga+Apartment,+Bijaylakshmi+Colony,+Chakravartipara,+Nabapally,+Barasat,+Kolkata,+West+Bengal+700126",
  mapCoords: "22.7249436,88.4745912",
  mapsShareLink: "https://maps.app.goo.gl/z7vS12GsMuJmTTaF6",
} as const;

/**
 * Production origin used when `VITE_SITE_URL` is not set (see docs/ENVIRONMENT.md).
 * This is the domain named in the README; override it per environment with
 * `VITE_SITE_URL` rather than editing this constant.
 */
export const DEFAULT_SITE_URL = "https://drdebayansaha.in";

/**
 * IANA timezone of the clinic, used to decide what "today" is for appointment dates.
 *
 * ASSUMPTION: the repository does not configure a timezone anywhere. The clinic is in
 * Barasat, West Bengal, so this is India Standard Time (UTC+05:30, no daylight saving).
 * Change it here if that is ever wrong - the form and the server both read this one value.
 */
export const CLINIC_TIMEZONE = "Asia/Kolkata";

export const OPENING_HOURS = [
  { days: "Every day", time: "10:30 AM – 1:30 PM & 6:00 PM – 9:00 PM" },
] as const;

export const NAV_ITEMS = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/services", label: "Services" },
  { to: "/gallery", label: "Gallery" },
  { to: "/reviews", label: "Reviews" },
  { to: "/contact", label: "Contact" },
] as const;

/**
 * Every public, indexable page - the single source of truth for canonical URLs
 * and `/sitemap.xml`. Add a new public page here as well as in `src/routes/`.
 * (`src/test/seo-routes.test.ts` fails if this list and the route tree drift apart.)
 */
export const INDEXABLE_PATHS = [
  "/",
  "/about",
  "/services",
  "/gallery",
  "/reviews",
  "/contact",
  "/book",
  "/privacy",
] as const;

export type IndexablePath = (typeof INDEXABLE_PATHS)[number];
