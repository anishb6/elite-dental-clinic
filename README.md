# Elite Dental Clinic — Barasat

Website for Dr. Debayan Saha's dental clinic in Barasat, West Bengal — **https://drdebayansaha.in**.

Patients can browse treatments, see clinic photos and before/after cases, locate the clinic on a map, and request an appointment online with timezone-aware scheduling (`Asia/Kolkata`) or via WhatsApp.

---

## Technical Stack

- **Framework**: TanStack Start (React 19, TypeScript, file-based routing, server functions, SSR)
- **Styling**: Tailwind CSS v4
- **Database**: Supabase (PostgreSQL) — Row Level Security strictly enforced; public direct client access revoked; trusted writes via server-only `service_role`
- **Email Notifications**: Resend — Transactional clinic alerts backed by a durable notification outbox with exponential retry
- **Validation**: Zod — Shared single-source-of-truth validation for client forms and server endpoints
- **State Management**: TanStack Query (mutations) & Supabase Auth (staff administration)
- **Testing**: three layers, described honestly in [docs/TESTING.md](docs/TESTING.md): Vitest + React Testing Library unit/component tests with mocked services (`npm test`), real-PostgreSQL integration tests that apply the migrations (`npm run test:integration`), and Playwright browser tests (`npm run test:e2e`)

---

## Getting Started

```sh
cp .env.example .env     # Fill in environment secrets (see docs/ENVIRONMENT.md)
npm install              # Install dependencies
npm run dev              # Start local development server
```

### Available Scripts

| Script                     | Purpose                                                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`              | Start development server with HMR                                                                                                         |
| `npm run build`            | Compile client assets and SSR worker bundle                                                                                               |
| `npm run preview`          | Preview production build locally                                                                                                          |
| `npm run typecheck`        | Run TypeScript type checks (`tsc --noEmit`)                                                                                               |
| `npm run lint`             | Run ESLint across codebase                                                                                                                |
| `npm run format`           | Format code with Prettier                                                                                                                 |
| `npm test`                 | Run the Vitest unit/component suite (mocked services, no database needed)                                                                 |
| `npm run test:integration` | Apply the migrations to a real PostgreSQL (`TEST_DATABASE_URL`, db name must contain `test`) and test permissions, RPCs and rate limiting |
| `npm run test:e2e`         | Playwright browser tests (Chromium). One-time: `npx playwright install chromium`                                                          |

---

## Project Structure

```text
src/
├── routes/            File-based routes (pages, admin portal, API endpoints)
│   ├── admin/         Staff Portal (/admin) and Staff Login (/admin/login)
│   ├── api/           Secure server endpoints (/api/create-appointment, /api/admin/*)
│   └── privacy.tsx    Patient Privacy Notice (Draft for DPDP Act review)
├── features/          Domain business logic and presentation
│   ├── appointments/  schemas · api/ · hooks/ · components/ · server/ (outbox & email)
│   ├── admin/         Staff appointment management & authorization server modules
│   └── clinic/        data (services, reviews, photos) + presentation components
├── components/        Reusable UI: layout (SiteLayout, Header, Footer), forms, feedback
├── config/            site.ts (clinic constants, opening hours), env.public.ts, env.server.ts
├── integrations/      Supabase client, admin proxy, types, and auth middleware
├── lib/               errors, logger, analytics, seo (JSON-LD), query-client
└── test/              Setup, SEO route assertions, and integration tests
```

Comprehensive documentation:

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**: Architectural layers, outbox pattern, and security model.
- **[docs/API.md](docs/API.md)**: Complete HTTP API contract, request/response formats, and error codes.
- **[docs/ENVIRONMENT.md](docs/ENVIRONMENT.md)**: Detailed environment variable guide and failure behaviors.
- **[docs/TESTING.md](docs/TESTING.md)**: What each test layer proves, how to run it, and the recorded verification history.
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**: Required migrations, live verification steps, and what the hosting platform must provide.

---

## Staff Admin Portal

Clinic staff can securely access the administrative dashboard at `/admin`:

- **Authentication**: Staff accounts are provisioned in the Supabase Dashboard under Authentication.
- **Features**: View paginated appointment requests, search by patient name/phone, filter by status, update statuses (`called`, `confirmed`, `visited`, `completed`, `no_show`, `cancelled`), and view notification delivery outbox states.
- **Notification Outbox Recovery**: Process pending or failed email retries on-demand with one click.
- **Security**: All dashboard data access and mutations are protected by server-side JWT verification; public access is denied with HTTP 401.

---

## SEO & Technical Standards

- **JSON-LD Structured Data**: Emits schema.org `Dentist` and `LocalBusiness` structured data including clinic coordinates, opening hours, and verified details.
- **Canonical URLs**: Automatically generated for all public pages on the confirmed production origin (`https://drdebayansaha.in`).
- **Sitemap & Robots**: `/sitemap.xml` and `/robots.txt` generated dynamically. Private `/admin/` and `/api/` endpoints are explicitly disallowed from indexing.
- **Zero Secrets**: Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `NOTIFY_SECRET`) are never bundled into client-side code.

Build trigger test — documentation only.
