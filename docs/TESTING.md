# Testing and Quality Assurance

## 1. Test layers

| Layer            | Command                    | Needs                                        | What it proves                                                                                                                                                                                                                                                                                                                                                                                                           | What it does **not** prove                                                                                                                |
| ---------------- | -------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Unit / component | `npm test`                 | Node only                                    | Validation, phone/date rules, form behaviour, error handling, rate-limit logic, auth/allowlist logic, email building, routing and SEO output. Supabase, Resend and Turnstile are **mocked**.                                                                                                                                                                                                                             | Anything about a real database, a real browser or deployed infrastructure.                                                                |
| Real database    | `npm run test:integration` | PostgreSQL, `TEST_DATABASE_URL`              | The actual migrations `0000`-`0005` apply in order; `anon`/`authenticated` are denied on every table and RPC; the booking RPC is atomic, de-duplicates replays and survives 10 concurrent identical requests; outbox claiming never double-claims (`SKIP LOCKED`), reclaims stale jobs and skips exhausted ones; the shared rate limiter counts correctly under concurrency; migration `0005` is demonstrably necessary. | Supabase-specific behaviour (PostgREST, Auth, hosted role defaults). The three Supabase roles are recreated locally.                      |
| Browser          | `npm run test:e2e`         | Chromium (`npx playwright install chromium`) | Pages render without uncaught errors in a real browser (desktop and mobile viewport); the booking form validates, focuses the first invalid field, blocks double submits and honeypot submissions, preserves input on server error and shows the success state; `robots.txt`, `sitemap.xml`, canonical links and the admin API 401.                                                                                      | The booking API is **intercepted** in these tests, so they do not exercise the server, database or email. Turnstile is off (no site key). |

Neither extra layer replaces a production smoke test (see section 4).

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

This run pre-dates the config-hygiene changes and the two new layers, so those are **not yet recorded as passing**:

| Item                                                                                            | Status                                                                                               |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Unit suite after config-hygiene changes (new tests in `env.server`, `env.public`, email, admin) | Not yet run - record result here                                                                     |
| `src/test/integration/safety.test.ts` (guard unit test, part of `npm test`)                     | Guard logic executed with `tsx` on 2026-10-27 (all cases passed); the Vitest file itself not yet run |
| `npm run test:integration` against real PostgreSQL                                              | Not yet run - record result here                                                                     |
| `npm run test:e2e` in Chromium                                                                  | Not yet run - record result here                                                                     |
| Production smoke test (deployed site, live Supabase, email delivery)                            | Not yet run - see `docs/DEPLOYMENT.md`                                                               |

## 3. Verification limitations

A passing local run establishes only that the automated tests passed in that environment on that date. It does not, by itself, establish that the deployed website, the live Supabase configuration (including that migrations were actually applied to the production project), email delivery, Turnstile enforcement, or every production security control has been verified. Record production smoke testing and deployment verification separately when performed, using the checks in `docs/DEPLOYMENT.md`.

## 4. Maintenance

Update this document whenever a meaningful test suite is added or a major verification milestone is completed. Do not put a test count in the README; counts drift and this file is the record.
