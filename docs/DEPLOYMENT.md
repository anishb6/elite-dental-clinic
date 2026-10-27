# Deployment checklist

The code in this repository enforces the security rules below, but several of them depend on
**database state and live configuration that code cannot prove**. Do not treat the site as
production-ready until every item here is verified against the real environment.

## 1. Database migrations (apply in order, in the Supabase SQL editor)

| Migration                                  | Purpose                                                                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `0002_security_hardening.sql`              | Removes all direct `anon` / `authenticated` access to `appointments`                                                 |
| `0003_notification_outbox_and_status.sql`  | Durable email outbox, status values                                                                                  |
| `0004_atomic_booking_and_outbox_claim.sql` | Atomic booking RPC, `SKIP LOCKED` claim RPC, shared rate limiter                                                     |
| `0005_revoke_public_function_execute.sql`  | **Required.** Removes the default `PUBLIC` EXECUTE grant from the three RPCs so the public anon key cannot call them |

Migrations are **not** applied automatically. `0005` contains a self-check and aborts if `anon` or
`authenticated` can still execute the functions.

### Verify live (expected results in brackets)

```sql
-- anon / authenticated must NOT be able to execute; service_role must.
SELECT p.proname,
       has_function_privilege('anon',         p.oid, 'EXECUTE') AS anon,          -- false
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated, -- false
       has_function_privilege('service_role',  p.oid, 'EXECUTE') AS service_role   -- true
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('create_appointment_with_outbox', 'claim_notification_outbox_jobs', 'check_rate_limit');
```

```bash
# With the PUBLIC anon key: both must fail (HTTP 401/403, code 42501) - never 200.
curl -i -X POST "$SUPABASE_URL/rest/v1/rpc/check_rate_limit" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"p_key":"probe","p_max":1,"p_window_seconds":1}'
curl -i "$SUPABASE_URL/rest/v1/appointments?select=id" -H "apikey: $SUPABASE_ANON_KEY"
```

## 2. Secrets / configuration (server-side, never `VITE_*`)

| Variable                                        | Requirement                                                                                                                                                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`     | Required. Booking fails with a 500 without them (no fallback)                                                                                                                                    |
| `TURNSTILE_SECRET_KEY`                          | **Required in production.** If missing, booking fails closed with a 500                                                                                                                          |
| `VITE_CLOUDFLARE_TURNSTILE_SITE_KEY`            | Public widget key; must pair with the secret above                                                                                                                                               |
| `RESEND_API_KEY`, `NOTIFY_EMAIL`, `NOTIFY_FROM` | Clinic email. Without them jobs stay `failed` in the outbox                                                                                                                                      |
| `NOTIFY_SECRET`                                 | Shared secret for `/api/retry-notifications` and `/api/notify-appointment`                                                                                                                       |
| `STAFF_EMAILS`                                  | **Required for email-based staff access.** Comma-separated staff allowlist. There is no fallback: if unset, nobody is admitted by email (only users with `app_metadata.role` of `admin`/`staff`) |

Verify Turnstile is enforced: a `POST /api/create-appointment` with no token, and one with the
well-known dummy token `XXXX.DUMMY.TOKEN.PASSXXXX`, must both be rejected (HTTP 400).

## 3. Supabase Auth (staff login)

- The allowlist matches on email, and the server only honours it for **verified** emails
  (`email_confirmed_at`). Also disable public sign-ups (or require email confirmation) so only staff
  accounts exist.
- Staff roles must be set via `app_metadata.role` (`admin` / `staff`) from the dashboard or with the
  service-role key. `user_metadata` is user-editable and is ignored.

## 4. What the hosting platform must provide

The application cannot provide these itself:

1. **A trustworthy client IP.** Rate limiting keys on `cf-connecting-ip` (Cloudflare), falling back
   to `x-real-ip` / `x-forwarded-for`. Those fallbacks are client-controlled unless a trusted proxy
   overwrites them, so the origin must only be reachable through Cloudflare (or another proxy that
   sets them).
2. **A scheduler.** Nothing in this repo runs retries automatically. Configure a Cloudflare Cron
   Trigger (or any external scheduler) to call `POST /api/retry-notifications` with the header
   `X-Notify-Secret: $NOTIFY_SECRET` every few minutes. Until then, only the immediate send at
   booking time and the staff "retry" button deliver email.
3. **Shared rate limiting is database-backed** (`check_rate_limit`, migration 0004/0005). If that
   RPC is unavailable the app logs `Shared rate limiter unavailable` and degrades to a per-instance
   limiter - treat that log line as an alert.

## 5. Known limitations (not blocking, but be aware)

- The immediate send at booking time does not claim the outbox row first, so a scheduler run in the
  same instant could send the same clinic email twice (duplicate email only; no lost booking).
- Outbox rows that fail for configuration reasons (email not configured, appointment missing) do
  not increment `attempts`, so they are re-tried on every scheduler run until fixed.
