# System Architecture

## Core Design Principles

1. **Thin Routes**: Route files in `src/routes/` declare URLs, SEO `<head>` metadata, and compose layout/components. Business logic is placed in domain features.
2. **Feature Isolation**: Everything concerning a domain lives in `src/features/<domain>/` (`appointments`, `clinic`, `admin`), colocating schemas, UI, hooks, and server modules.
3. **Single Trusted Server Write Path**: The browser never inserts directly into the database. All appointment creation is routed through `POST /api/create-appointment`, which validates inputs, handles honeypots and replays, writes via `service_role`, and queues durable notifications.
4. **Zero Secrets in Client Code**: All secrets (`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `NOTIFY_SECRET`) are read strictly in `*.server.ts` modules and imported dynamically inside server handlers.
5. **Durable Notification Outbox**: Email notifications are managed via a database-backed outbox (`public.notification_outbox`) with exponential backoff and idempotency, ensuring no booking is lost if Resend experiences downtime.
6. **Patient Privacy & DPDP Minimization**: Health notes are kept in the secured staff dashboard and are omitted from plain-text emails. Patient consent is collected on the booking form.
7. **Uniform Error Handling**: Every failure across boundaries is normalized into an `AppError` with a user-safe message, while raw technical details remain in server logs.

---

## Folder Map

```text
src/
├── routes/        THIN. URLs, <head>/SEO and composition only. No business logic.
│   └── api/       HTTP endpoints; each one lazy-imports its handler (see "Adding an endpoint")
├── features/<domain>/        appointments · admin · clinic · home · about
│   ├── components/           UI for that domain
│   ├── hooks/                state + data fetching for that domain (no JSX)
│   ├── api/                  browser-side calls to /api/* (no UI)
│   ├── server/               *.server.ts - server-only logic, secrets, database
│   ├── data/                 static content (services, reviews, photos)
│   └── schemas.ts, types.ts, constants.ts
├── components/    Reusable, domain-agnostic UI: layout/ · forms/ · feedback/
├── hooks/         Reusable, domain-agnostic hooks (useDebouncedValue, useDisclosure, useHydrated)
├── api/           Browser HTTP layer shared by all features: http-client, types, endpoints
├── server/        Server plumbing shared by all features: http/ (handler wrapper, responses,
│                  rate limit, shared-secret guard) · services/ (database, email, turnstile)
├── config/        site.ts (clinic facts) · env.public.ts (VITE_*) · env.server.ts (secrets)
├── lib/           Cross-cutting helpers: errors, logger, seo, sitemap, analytics, query-client
├── integrations/  Generated Supabase client/types - do not edit by hand
└── test/          Test setup, routing/SEO tests, DB integration tests
```

**Dependency direction** (never import "upwards"):
`routes -> features -> components/hooks/api/server/config/lib`. A feature may import shared
folders, never another feature's `server/` code; `components/` never imports from `features/`.

## Naming Conventions

- Files and folders: `kebab-case` (`booking-form.tsx`, `use-admin-session.ts`). Components are
  `PascalCase` exports; hooks start with `use`.
- `*.server.ts`: server-only module (secrets, service-role database). Never import it statically
  from a route or component; use a dynamic `import()` inside the handler. Never name a module that
  runs during SSR `*.client.ts`.
- `*.api.ts`: browser-side HTTP calls for one feature. `*.test.ts(x)` sits next to the file it tests.
- Constants: `SCREAMING_SNAKE_CASE`; types: `PascalCase`.

## Component Layers & Data Flow

```text
Booking (public):
  routes/book.tsx                                  SEO + <BookingForm />
    └─ features/appointments/components/booking-form.tsx   uncontrolled form, inline validation,
         │                                                  (layout and validation wiring only)
         ├─ components/honeypot-field.tsx, privacy-consent-field.tsx   small reusable pieces
         ├─ hooks/use-turnstile.ts                 bot-challenge widget: script, token, reset
         └─ hooks/use-book-appointment.ts          TanStack Query mutation (+ analytics)
              └─ api/appointments.api.ts           apiRequest(CREATE_APPOINTMENT_ENDPOINT)

  routes/api/create-appointment.ts                 -> withApiHandler + rateLimitShared
    └─ features/appointments/server/create-appointment.server.ts
         ├─ schemas.ts            Zod validation, phone normalisation, IST date checks
         ├─ turnstile.server.ts   Cloudflare bot verification
         ├─ replay / duplicate guard (2-minute window)
         ├─ database.server.ts    getAdminClient(): service-role Supabase client
         └─ notification-outbox.server.ts
              ├─ notification_outbox (insert pending job, unique per appointment)
              └─ claimAndDeliverNotification() -> email.server.ts (Resend)

Staff portal:
  routes/admin/login.tsx   -> features/admin/components/admin-login-form.tsx   (Supabase Auth)
  routes/admin/index.tsx   -> features/admin/components/admin-dashboard.tsx
    ├─ hooks/use-admin-session.ts          auth session + redirect to login
    ├─ hooks/use-admin-dashboard-state.ts  UI state reducer (filter, search, page, dialogs)
    ├─ hooks/use-admin-appointments.ts     server state (TanStack Query list + mutations)
    └─ api/admin.api.ts                    apiRequest(ADMIN_*_ENDPOINT, Bearer token)

  routes/api/admin/*  -> withApiHandler -> features/admin/server/admin-appointments.server.ts
    GET   /api/admin/appointments   paginated list + outbox statuses
    PATCH /api/admin/appointments   status updates
    POST  /api/admin/retry-outbox   manual outbox retry

Internal (secret-protected, for cron / workers):
  POST /api/retry-notifications  -> requireNotifySecret()
```

---

## Database Architecture & Access Model

- **`public.appointments`**: Stores patient booking requests.
  - Row Level Security: **ENABLED**.
  - Client Privileges (`anon`, `authenticated`): **REVOKED ALL**.
  - Server Privileges (`service_role`): **GRANT ALL**.
  - Status Check Constraint: `CHECK (status IN ('new', 'called', 'confirmed', 'visited', 'completed', 'no_show', 'cancelled'))`.
  - Consent record: `privacy_consent_at` (timestamptz) and `privacy_policy_version` (text). Both are set by the
    server inside `create_appointment_with_outbox` (clock = server time, version = `PRIVACY_POLICY_VERSION`
    in `features/appointments/constants.ts`), never taken from the browser. They are nullable because rows
    created before migration `0006` have no consent record. Bump the version when `routes/privacy.tsx` changes meaningfully.
- **`public.notification_outbox`**: Transactional outbox table for email notifications.
  - Foreign Key: `appointment_id REFERENCES public.appointments(id) ON DELETE CASCADE`.
  - Idempotency Constraint: `UNIQUE (appointment_id)`.
  - Status: `'pending' | 'processing' | 'sent' | 'failed'`.
  - Backoff: `attempts`, `max_attempts`, `next_attempt_at`, `last_error`.
  - Row Level Security: **ENABLED**, client privileges revoked, accessible only via `service_role`.

---

## State Management

State is split by _what kind of state it is_; each kind has exactly one owner.

| State                    | Owner                                                                         |
| ------------------------ | ----------------------------------------------------------------------------- |
| Server data (admin list) | TanStack Query: `useAdminAppointments` (query + mutations, cache patching)    |
| Server writes (booking)  | TanStack Query `useMutation`: `useBookAppointment`                            |
| Dashboard UI state       | `useReducer`: `useAdminDashboardState` (pure `dashboardReducer`, unit tested) |
| Staff auth session       | Supabase Auth, exposed through `useAdminSession`                              |
| Routing / page           | TanStack Router (file-based)                                                  |
| Booking form fields      | Uncontrolled inputs read via `FormData`; per-field errors in component state  |
| Static clinic content    | Typed constants in `src/config/site.ts` and `features/clinic/data/`           |

A global client store (Redux/Zustand) is intentionally not used: nothing is shared across distant
parts of the tree that Query, the router, or a feature-level reducer don't already cover.

---

## Error Handling

- Every failure that crosses a boundary becomes an `AppError` (`src/lib/errors.ts`) with a stable
  `code`, an optional HTTP `status`, a technical `message` (logged) and a visitor-safe `userMessage`.
- **Server**: handlers throw; `withApiHandler` logs a sanitised line and returns the
  `{ ok: false, error }` envelope. No route has its own `try/catch` or ad-hoc status codes.
- **Browser**: `apiRequest` turns offline, timeout, non-2xx and malformed bodies into `AppError`s;
  UI shows `getUserMessage(error)` and branches on `getErrorStatus(error)` (e.g. 401 -> login).
- **Rendering**: `components/feedback/route-error.tsx` and `not-found.tsx` are the route boundaries;
  `src/server.ts` / `src/start.ts` catch anything that escapes and render a static error page.
- Never write an empty `catch`. Either handle it, or log it with `createLogger(scope)` and say why
  it is safe to continue.

---

## Configuration & Environment

- Clinic facts (phone, hours, address): `src/config/site.ts` only.
- Public, build-time values (`VITE_*`): read via `src/config/env.public.ts`.
- Secrets: read via `src/config/env.server.ts` only (`getServerDatabaseEnv`, `getNotifyEnv`,
  `getNotifySecret`, `getTurnstileSecret`, `hasServiceRoleKey`, `getStaffAllowlist`). No other
  module reads `process.env` or `import.meta.env`.
- Variables are documented in `.env.example` and `docs/ENVIRONMENT.md`.

---

## Adding an endpoint

1. Add the path to `src/api/endpoints.ts` if the browser calls it.
2. Write the handler `(request: Request) => Promise<Response>` in
   `features/<domain>/server/<name>.server.ts`; validate input with Zod, `throw new AppError(...)`
   for failures, return `jsonOk(data)`.
3. Create `src/routes/api/<name>.ts` that lazy-imports `withApiHandler` and the handler inside the
   method handler (keeps server code out of the client bundle). Add `rateLimit`/`rateLimitShared`
   for public endpoints, `requireNotifySecret(request)` for internal ones, or the staff guard in
   `admin-appointments.server.ts` for staff ones.
4. Add a browser wrapper in `features/<domain>/api/*.api.ts` built on `apiRequest`.
5. Document it in `docs/API.md` and add a test next to the handler.
