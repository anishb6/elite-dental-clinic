# Website for Dr. Debayan Saha — Elite Dental Clinic Barasat

Premium & modern look: deep navy, warm cream, gold accents, elegant serif headings (e.g. Cormorant / Playfair) with a clean sans body.

## Pages

- **Home** — large welcome banner with clinic photo, "Book Appointment" button, short intro of Dr. Saha, top treatments, reviews preview, contact strip.
- **About** — Dr. Saha's story, qualifications, clinic values, clinic photos.
- **Services** — all 15 treatments as cards (general dentistry, cleaning, fillings, root canal, extraction, crowns, whitening, gum treatment, dentures, children's dentistry, emergencies, cosmetic, sensitivity, bad breath, broken teeth), each with a short patient-friendly description using the search phrases you gave (good for Google).
- **Gallery** — before/after smile results and clinic pictures (sample images to start, replace with yours later).
- **Reviews** — patient testimonials (placeholders until you share real ones).
- **Book Appointment** — form: name, phone, email, treatment, preferred date/time, message. Requests are saved so you can view them.
- **Contact** — address, phone, hours, map, WhatsApp button.

Shared header with menu and a sticky "Book Now" button; footer with contact info and hours.

## Things I'll need from you later

Clinic address/city, phone, opening hours, qualifications, real photos and reviews. I'll use clearly marked placeholders until then.

## Technical details

- TanStack routes: index, about, services, gallery, reviews, book, contact — each with unique SEO head() metadata.
- Design tokens in src/styles.css (oklch navy/cream/gold), fonts via link in __root.
- Generated images for banner, clinic, gallery.
- Appointment form stored via Lovable Cloud (appointments table, public insert only, no public read) with validation.