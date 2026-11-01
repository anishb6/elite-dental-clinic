# Design decisions

Why the site is built the way it is. Each entry: the problem, what was chosen, what was rejected, and
the trade-off. Read [ARCHITECTURE.md](ARCHITECTURE.md) for _how_ the pieces fit; this file is _why_.

## 1. Bookings go through one server endpoint, never straight from the browser

- **Problem:** a booking contains a patient's name, phone and health note. Anything the browser can
  write to, anyone can write to or read from.
- **Chosen:** the browser calls `POST /api/create-appointment`. The database denies the public
  (`anon`/`authenticated`) roles on every table and function (Row Level Security + revoked grants), so
  only the server, using the service-role key, can write.
- **Rejected:** inserting from the browser with the public Supabase key and a permissive policy. It's
  simpler, but then validation, bot checks and rate limiting can all be bypassed by calling the
  database directly.
- **Trade-off:** one more hop and a secret to protect, in exchange for a single place that enforces every rule.

## 2. A booking and its email job are created in one database transaction

- **Problem:** if the app saved the appointment and then crashed before queuing the email, the clinic
  would never hear about the patient.
- **Chosen:** a Postgres function (`create_appointment_with_outbox`) inserts both rows in a single
  transaction. It takes an advisory lock on (phone, date, time) so two simultaneous identical
  submissions are serialised, and returns the existing booking if the same one arrived in the last
  2 minutes (double-clicks, retries).
- **Rejected:** two separate inserts from application code, and in-memory "did I just see this" checks
  (which don't work across several server instances).
- **Trade-off:** logic lives in SQL, which is harder to unit test. The real-database integration tests
  exist for exactly this reason (including 10 concurrent identical requests).

## 3. Email goes through an outbox with retries

- **Problem:** the email provider (Resend) can be down or slow. The patient must still get a
  confirmation, and the clinic must still get the alert later.
- **Chosen:** the booking is saved first, delivery is attempted straight away, and a failure is
  recorded on the outbox row. Retries back off (2 min, 10 min, 30 min, then 2 h) up to 5 attempts.
  Workers claim jobs with `FOR UPDATE SKIP LOCKED` so two workers never send the same email, and a job
  stuck "processing" for 10 minutes is reclaimed. Staff can also trigger a retry from `/admin`.
- **Rejected:** failing the booking when email fails (the patient loses their request), or
  fire-and-forget (failures vanish).
- **Trade-off:** retries need a scheduler. A Nitro scheduled task (`src/server/tasks/retry-notifications.ts`)
  runs every 5 minutes as a Cloudflare Cron Trigger inside the same Worker, so it needs no HTTP call or
  secret. `POST /api/retry-notifications` stays for on-demand runs.

## 4. Three cheap layers against spam bookings

- **Honeypot field:** a hidden input real visitors never fill. Bots that do get a fake "success" so they
  don't learn what tripped them.
- **Cloudflare Turnstile:** a privacy-friendlier CAPTCHA, verified on the server. In production a
  missing secret **fails closed** (bookings are refused), rather than silently skipping the check.
- **Rate limiting:** 10 requests per minute per IP. The count is shared across server instances through
  the database; if the database isn't available it falls back to a per-instance counter and logs a warning.
- **Trade-off:** the fallback limiter is weaker (the limit multiplies by the number of instances), which
  is acceptable for a small clinic and is called out in the code.

## 5. One validation definition for browser and server

The Zod schemas in `features/appointments/schemas.ts` are used by the form (instant feedback) and by
the endpoint (the real check). The two can't drift apart, and the server never trusts the browser. Phone
numbers are normalised to E.164 (`+91...`) so duplicates are detected reliably.

## 6. Dates are calendar dates in the clinic's timezone

A preferred appointment date is a plain `YYYY-MM-DD` string compared with "today" in `Asia/Kolkata`,
never a UTC timestamp. Otherwise a visitor booking late in the evening could be told that today is
"in the past" because UTC is already tomorrow.

## 7. One error model, one response shape

Anything that goes wrong becomes an `AppError` with a stable code, an HTTP status, a technical message
(logged) and a visitor-safe message (shown). Every `/api/*` route returns `{ ok, data }` or
`{ ok: false, error }`. Logs record error codes, not patient details.

## 8. Staff access is checked on the server, using something the user can't edit

The dashboard sends the Supabase session token. The server verifies it, then allows access only if the
account has an `app_metadata.role` of admin/staff (set server-side) **or** a _verified_ email on the
`STAFF_EMAILS` allowlist. `user_metadata` is deliberately never trusted because users can edit it. With
no allowlist configured, access fails closed.

## 9. State management: each kind of state has one owner

TanStack Query holds server data; a small reducer holds dashboard UI state (filters, page, dialogs);
Supabase Auth holds the session; the router holds the page. No global store (Redux/Zustand): nothing is
shared across distant parts of the app that these don't already cover.

## 10. Privacy by default

Patients tick an explicit consent box (India's DPDP Act). Health notes are shown in the staff dashboard
but kept out of the plain-text email. The privacy page states what is collected and why. The consent is
stored with each booking (time and policy version, stamped by the server) so it can be shown later.

## 11. Code organisation

Routes only declare URLs, SEO and composition. Each domain (`appointments`, `admin`, `clinic`) owns its
components, hooks, API calls and server code. Imports only flow downward (routes -> features -> shared
code), and server-only files are named `*.server.ts` and loaded lazily so secrets can't reach the
browser bundle. The build fails if browser code imports a `server/` folder.

## 12. SEO and analytics

`INDEXABLE_PATHS` is the single list that drives canonical links, `sitemap.xml` and `robots.txt`. Pages
emit schema.org `Dentist` data. Google Analytics 4 records the booking funnel: `book_click`,
`call_click`, `whatsapp_click`, `directions_click`, `booking_submitted` and `booking_failed`, and does
nothing when no GA ID is configured.

## 13. Hosting

Server-rendered on Cloudflare Workers (via Nitro) with Supabase (Mumbai region) for data. The build
configuration in `vite.config.ts` is explicit, with no wrapper packages.

## Known limitations (and what I'd do next)

- **Retries stop after 5 attempts.** A job that keeps failing is marked `EXHAUSTED` and needs a person to fix the cause (usually email configuration) and reset the job.
- **Requests, not live slots.** A booking is a request the clinic confirms by phone; there's no calendar
  of available slots or double-booking prevention across different patients.
- **Browser tests mock the booking API.** Real-database tests cover the server side; a production smoke test is a separate checklist.
- **Single staff role.** Any authorised staff member can see every appointment and change any status.
