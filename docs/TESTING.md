# Testing and Quality Assurance

## 1. Test layers

| Layer            | Command                    | Needs                                        | What it proves                                                                                                                                                                                                                                                                                                                                                                                                           | What it does **not** prove                                                                                                                |
| ---------------- | -------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Unit / component | `npm test`                 | Node only                                    | Validation, phone/date rules, form behaviour, error handling, rate-limit logic, auth/allowlist logic, email building, routing and SEO output. Supabase, Resend and Turnstile are **mocked**.                                                                                                                                                                                                                             | Anything about a real database, a real browser or deployed infrastructure.                                                                |
| Real database    | `npm run test:integration` | PostgreSQL, `TEST_DATABASE_URL`              | The actual migrations `0000`-`0006` apply in order; `anon`/`authenticated` are denied on every table and RPC; the booking RPC is atomic, de-duplicates replays and survives 10 concurrent identical requests; outbox claiming never double-claims (`SKIP LOCKED`), reclaims stale jobs and skips exhausted ones; the shared rate limiter counts correctly under concurrency; migration `0005` is demonstrably necessary. | Supabase-specific behaviour (PostgREST, Auth, hosted role defaults). The three Supabase roles are recreated locally.                      |
| Browser          | `npm run test:e2e`         | Chromium (`npx playwright install chromium`) | Pages render without uncaught errors in a real browser (desktop and mobile viewport); the booking form validates, focuses the first invalid field, blocks double submits and honeypot submissions, preserves input on server error and shows the success state; `robots.txt`, `sitemap.xml`, canonical links and the admin API 401.                                                                                      | The booking API is **intercepted** in these tests, so they do not exercise the server, database or email. Turnstile is off (no site key). |

Neither extra layer replaces a production smoke test (see `docs/DEPLOYMENT.md`).

### Running the real-database tests

```sh
# any throwaway LOCAL PostgreSQL 13+; the database name MUST contain "test" as a whole word
docker run --rm -d --name clinic-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=clinic_test -p 5432:5432 postgres:16

TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/clinic_test npm run test:integration
```

The suite **drops and recreates the `public` schema**. It refuses to run unless the database name contains `test` as a whole word (`clinic_test`, not `latest`), the host is local (`localhost`, `127.x.x.x`, `::1`; remote hosts need `ALLOW_REMOTE_TEST_DB=1`) and the host is not Supabase (never allowed). The rules live in `src/test/integration/safety.ts` and are covered by `safety.test.ts`, which runs in the normal `npm test`. Without `TEST_DATABASE_URL` it is skipped locally; in CI `REQUIRE_INTEGRATION=1` turns a missing URL into a failure so it can never pass by skipping.

PowerShell:

```powershell
$env:TEST_DATABASE_URL = "postgres://postgres:postgres@localhost:5432/clinic_test"
npm run test:integration
```

### Running the browser tests

```sh
npm install -D @playwright/test      # first time only (updates package.json + package-lock.json)
npx playwright install chromium
npm run test:e2e
```

Playwright starts the dev server itself with dummy Supabase credentials (it cannot reach a real project). Set `E2E_BASE_URL` to test an already-running site instead; only the read-only checks (pages, robots, sitemap, admin 401) are meaningful against a live site.

## 2. Verification record

Record the date, command and result of each significant run. Results below are only what was actually observed.

### 2026-10-27 - unit / component suite (local development environment)

- Test framework: Vitest 4.1.12
- Command: `vitest run` (Windows: `.\node_modules\.bin\vitest.cmd run`)
- Result: **PASS** - 26 test files, 284 tests passed, 0 failed
- Single-file example: `.\node_modules\.bin\vitest.cmd run src/features/appointments/server/create-appointment.server.test.ts`

Areas covered by that run: appointment form validation and booking workflows; phone normalization and date validation; duplicate-submission protection; atomic booking via the database RPC (mocked client); email-failure handling and retry behaviour; Cloudflare Turnstile verification; admin authentication/authorization; API rate limiting; static checks of the permission migrations; frontend booking form behaviour and error handling; booking journey simulation; routing and SEO checks.

### 2026-10-28 - after the structure refactor and build-config change (sandbox, Linux, Node 22)

| Check                                                      | Result                                                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `npm run typecheck`                                        | PASS                                                                                       |
| `npm run lint` / `npm run format:check`                    | PASS                                                                                       |
| `npm test` (Vitest 4.1.12)                                 | PASS - 32 test files, 325 tests                                                            |
| `npm run build`                                            | PASS - `.output/server/wrangler.json` identical to the build made with the previous config |
| `npm run test:e2e` (Chromium, desktop and mobile viewport) | PASS - 36 tests (browser binary supplied by the sandbox, not `npx playwright install`)     |
| `npm run test:integration` against real PostgreSQL         | Not recorded here - see the maintainer's run below                                         |
| Production smoke test (live site, Supabase, email)         | **Not run** - see `docs/DEPLOYMENT.md`                                                     |

### 2026-10-28 - after adding the scheduled retry (sandbox)

| Check                                           | Result                                                                                  |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| `npm run typecheck` / `npm run lint`            | PASS                                                                                    |
| `npm test`                                      | PASS - 34 test files, 329 tests                                                         |
| `npm run build`                                 | PASS - `.output/server/wrangler.json` contains `triggers.crons: ["*/5 * * * *"]`        |
| Cron actually firing on Cloudflare after deploy | **Not verified** - check the Worker's Cron Triggers and logs (see `docs/DEPLOYMENT.md`) |

### 2026-10-28 - after the seven-item fix list (sandbox, Linux, Node 22; PostgreSQL 16 for the database run)

| Check                                                                                  | Result                                                                                                              |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck` / `npm run lint` / `npm run format:check`                          | PASS                                                                                                                |
| `npm test`                                                                             | PASS - 33 test files, 331 tests                                                                                     |
| `npm run test:integration` (local PostgreSQL 16, all migrations `0000`-`0006` applied) | PASS - 1 file, 31 tests                                                                                             |
| `npm run build`                                                                        | PASS - `src/routeTree.gen.ts` regenerated by the build and no longer contains `/api/notify-appointment`             |
| `npm run test:e2e` (Chromium, desktop and mobile viewport)                             | PASS - 36 tests (browser binary supplied by the sandbox via a throwaway local config, not `npx playwright install`) |
| Production smoke test (live site, Supabase, email)                                     | **Not run**                                                                                                         |
| Migration `0006` on the real Supabase project                                          | **Not applied or verified** - apply it before deploying this code (see `docs/DEPLOYMENT.md`)                        |

New tests in this round:

- **Consent storage** (`create-appointment.server.test.ts`): the RPC receives the server clock and `PRIVACY_POLICY_VERSION`; a consent time or version sent by the browser is ignored.
- **Consent in the database** (`database.integration.test.ts`): consent time and version are stored; they stay `NULL` when not given; exactly one version of the booking function exists (the old 9-argument one is gone). The existing permission checks now use the new 11-argument signature.
- **Migration `0006` static checks** (`database-function-permissions.test.ts`): nullable columns, old function dropped, `REVOKE` from `PUBLIC`/`anon`/`authenticated`, only `service_role` granted, self-check present.
- **Admin status update** (`admin-appointments.server.test.ts`): 404 "Appointment not found" for an unknown id; the staff user id is logged on success.
- **Admin search** (`admin-appointments.server.test.ts`): a formatted phone becomes a digits-only phone filter (also checked at the handler level); short and non-numeric terms are unchanged; empty input gives no filter; the injection check still holds.
- **No-store** (`admin-appointments.server.test.ts`): the list, status update and retry-outbox success responses carry `Cache-Control: no-store`.
- **Removed with the dead code:** the `enqueueNotification` test and the `/api/notify-appointment` handler tests.

### 2026-10-28 - after splitting the booking form (sandbox)

`booking-form.tsx` went from 379 to about 200 lines: the Turnstile widget logic moved to `use-turnstile.ts`,
`useHydrated` to `src/hooks/`, and the honeypot and consent checkbox became small components. No behaviour change.

| Check                                             | Result                          |
| ------------------------------------------------- | ------------------------------- |
| `npm run typecheck` / `npm run lint` / `npm test` | PASS - 33 test files, 331 tests |
| `npm run build`                                   | PASS                            |
| `npm run test:e2e` (Chromium, desktop and mobile) | PASS - 36 tests                 |

### 2026-10-31 - privacy notice finalised (sandbox)

`src/routes/privacy.tsx` rewritten (Draft banner removed; contact email, service providers, Google Analytics and
retention wording added); `PRIVACY_POLICY_VERSION` is now `"2026-10-31"`. The wording has not had a legal review.

| Check                                             | Result                          |
| ------------------------------------------------- | ------------------------------- |
| `npm run typecheck` / `npm run lint` / `npm test` | PASS - 33 test files, 331 tests |
| `npm run build`                                   | PASS                            |
| `npm run test:e2e`, `npm run test:integration`    | Not re-run for this change      |

### 2026-10-28 - maintainer's own run on their machine

The maintainer ran the tests locally after receiving the refactor and reports that everything passed.
This is the maintainer's report; the exact commands and counts were not captured here. When convenient,
paste the output of each command (especially `npm run test:integration`) so this file shows evidence
rather than a summary.

## 3. Verification limitations

A passing local run establishes only that the automated tests passed in that environment on that date. It does not, by itself, establish that the deployed website, the live Supabase configuration (including that migrations were actually applied to the production project), email delivery, Turnstile enforcement, or every production security control has been verified. Record production smoke testing and deployment verification separately when performed, using the checks in `docs/DEPLOYMENT.md`.

## 4. Maintenance

Update this document whenever a meaningful test suite is added or a major verification milestone is completed. Do not put a test count in the README; counts drift and this file is the record.
