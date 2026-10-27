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

## Component Layers & Data Flow

```text
Browser / Client Layer:
  routes/book.tsx                  SEO + <BookingForm />
    └─ components/booking-form.tsx Uncontrolled form, inline validation, honeypot, consent
         └─ hooks/use-book-appointment.ts  TanStack Query mutation
              └─ api/appointments.api.ts   HTTP client POST /api/create-appointment

Server Boundary:
  routes/api/create-appointment.ts
    └─ withApiHandler + rateLimit
         └─ server/create-appointment.server.ts
              ├─ schemas.ts (Zod validation, phone normalization, IST date checks)
              ├─ turnstile.server.ts (Cloudflare bot verification)
              ├─ Replay / duplicate guard (2-minute window)
              ├─ Supabase DB: appointments (insert with status 'new' via service_role)
              └─ server/notification-outbox.server.ts
                   ├─ notification_outbox (insert pending job, unique per appointment)
                   └─ deliverNotification() -> Resend email dispatch
                        └─ appointment-email.server.ts (HTML template with staff portal link)

Staff Admin Management:
  routes/admin/login.tsx           Supabase Auth signInWithPassword
  routes/admin/index.tsx           Protected Staff Portal (session verified)
    ├─ GET /api/admin/appointments (paginated list + outbox statuses)
    ├─ PATCH /api/admin/appointments (status updates: called, confirmed, visited, completed)
    └─ POST /api/admin/retry-outbox (manual outbox retry trigger)
```

---

## Database Architecture & Access Model

- **`public.appointments`**: Stores patient booking requests.
  - Row Level Security: **ENABLED**.
  - Client Privileges (`anon`, `authenticated`): **REVOKED ALL**.
  - Server Privileges (`service_role`): **GRANT ALL**.
  - Status Check Constraint: `CHECK (status IN ('new', 'called', 'confirmed', 'visited', 'completed', 'no_show', 'cancelled'))`.
- **`public.notification_outbox`**: Transactional outbox table for email notifications.
  - Foreign Key: `appointment_id REFERENCES public.appointments(id) ON DELETE CASCADE`.
  - Idempotency Constraint: `UNIQUE (appointment_id)`.
  - Status: `'pending' | 'processing' | 'sent' | 'failed'`.
  - Backoff: `attempts`, `max_attempts`, `next_attempt_at`, `last_error`.
  - Row Level Security: **ENABLED**, client privileges revoked, accessible only via `service_role`.

---

## State Management

| State                     | Tool                                                                         |
| ------------------------- | ---------------------------------------------------------------------------- |
| Server Writes & Mutations | TanStack Query (`useMutation`)                                               |
| Routing & Page Parameters | TanStack Router (file-based routing)                                         |
| Staff Auth State          | Supabase Auth (`getSession`, `onAuthStateChange`)                            |
| Form Fields               | Uncontrolled inputs via `FormData`; per-field validation in component state  |
| Static Clinic Content     | Strongly typed constants in `src/config/site.ts` and `features/clinic/data/` |
