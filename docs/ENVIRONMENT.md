# Environment Variables & Configuration

Code is strictly separated from configuration: **no credentials or secret keys appear in source files, and the site origin used in links comes from `VITE_SITE_URL`.**

| Module                        | Reads                             | Runs in                     | Purpose                                                            |
| ----------------------------- | --------------------------------- | --------------------------- | ------------------------------------------------------------------ |
| `src/config/env.public.ts`    | `VITE_*` only                     | browser + SSR               | Inlined at build time for public assets, canonical SEO, analytics  |
| `src/config/env.server.ts`    | Server secrets from `process.env` | server only (`*.server.ts`) | Validates database and notification secrets at the server boundary |
| `src/integrations/supabase/*` | Supabase URL & keys               | client / server             | Provides client SDK (anon) and admin SDK (`service_role`)          |

---

## 1. Client Environment (Public)

Inlined into the browser bundle at build time. Only variables prefixed with `VITE_` are exposed.

| Variable                             | Required | Description                                                                                                                                                                  |
| ------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`                  | **Yes**  | Your Supabase project URL (`https://<project-ref>.supabase.co`).                                                                                                             |
| `VITE_SUPABASE_PUBLISHABLE_KEY`      | **Yes**  | Supabase publishable (anon) key. Safe for browser use with Row Level Security.                                                                                               |
| `VITE_SUPABASE_PROJECT_ID`           | **Yes**  | Supabase project ID identifier.                                                                                                                                              |
| `VITE_SITE_URL`                      | No       | Canonical production origin (`https://drdebayansaha.in`). Strip trailing slashes. Inlined at build time. Drives canonical links, OG tags, `/sitemap.xml`, and `/robots.txt`. |
| `VITE_GA_ID`                         | No       | Google Analytics 4 Measurement ID (`G-XXXXXXXXXX`). Analytics is inert when unset.                                                                                           |
| `VITE_CLOUDFLARE_TURNSTILE_SITE_KEY` | No       | Cloudflare Turnstile public site key for client bot challenge.                                                                                                               |

> [!NOTE]
> `env.public.ts` is intentionally **not** named `*.client.ts` because TanStack Start's import protection strips `*.client.ts` from SSR bundles, whereas canonical URL generation is executed during SSR.

---

## 2. Server Environment (Secrets)

Read strictly at runtime on the server (e.g., Cloudflare Workers / Nitro runtime). **Never prefix these with `VITE_` and never import them into browser components.**

| Variable                    | Required For            | Description                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SUPABASE_URL`              | Booking & Admin         | Supabase project URL used by server endpoints.                                                                                                                                                                                                                                                                                                                                             |
| `SUPABASE_SERVICE_ROLE_KEY` | **Booking & Admin**     | **Required**. Bypasses RLS to allow `/api/create-appointment` and the outbox processor to safely insert appointments and outbox records, and allows staff admin operations. Never expose to client bundles.                                                                                                                                                                                |
| `STAFF_EMAILS`              | **Admin Authorization** | Comma-separated list of staff emails authorized to access the `/admin` portal (e.g., `drdebayansaha@drdebayansaha.in,clinic.admin@drdebayansaha.in`). Addresses must also be verified in Supabase Auth. **No fallback**: if unset, no one is admitted by email (fails closed); only users whose server-set `app_metadata.role` is `admin`/`staff` get in. Everyone else receives HTTP 403. |
| `RESEND_API_KEY`            | Email Notifications     | Resend transactional email API key. If absent, appointments are still safely persisted to the database and queued in the outbox; patients receive a success confirmation.                                                                                                                                                                                                                  |
| `NOTIFY_EMAIL`              | Email Notifications     | Recipient email address(es) for clinic appointment alerts (comma-separated).                                                                                                                                                                                                                                                                                                               |
| `NOTIFY_FROM`               | Email Notifications     | Sender email address (default: `Website Bookings <onboarding@resend.dev>`).                                                                                                                                                                                                                                                                                                                |
| `NOTIFY_SECRET`             | Internal Endpoints      | Shared secret for internal administrative endpoints and scheduled cron triggers (`/api/retry-notifications`).                                                                                                                                                                                                                                                                              |
| `TURNSTILE_SECRET_KEY`      | Bot Protection          | Cloudflare Turnstile secret key for server-side token validation.                                                                                                                                                                                                                                                                                                                          |

---

## 3. Failure Behavior & Safeguards

- **Missing `SUPABASE_SERVICE_ROLE_KEY`**: `/api/create-appointment` rejects with HTTP 500 (`CONFIG`). The user sees a friendly error message advising them to call the clinic. Technical secrets are never leaked.
- **Missing `RESEND_API_KEY` or `NOTIFY_EMAIL`**: The booking is safely created and saved in `public.appointments`. An outbox job is created in `public.notification_outbox` with status `pending`. Once email credentials are provided, clinic staff can retry pending outbox items via the Staff Admin Dashboard or `/api/retry-notifications`.
- **Missing `NOTIFY_SECRET`**: Any invocation of internal notification endpoints is rejected with HTTP 500 (`CONFIG`). Authentication is **never skipped**.
