# Elite Dental Clinic — Barasat

Website for Dr. Debayan Saha's dental clinic in Barasat, West Bengal. Live at **https://drdebayansaha.in**.

Patients can browse treatments, read real Google reviews, see before/after cases, find the clinic on a map, and request an appointment online or via WhatsApp.

## Stack

- TanStack Start (React, TypeScript, file-based routing, SSR)
- Tailwind CSS + shadcn/ui components
- Supabase (Postgres) for storing appointment requests, with row-level security (public insert only, no public read)
- Resend for emailing the clinic on each new request

## Run locally

```sh
cp .env.example .env   # fill in your own Supabase values
npm install
npm run dev
```

Server-side environment variables (set on your host, never committed): `RESEND_API_KEY`, `NOTIFY_EMAIL`, `NOTIFY_FROM`.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm test` — run tests
