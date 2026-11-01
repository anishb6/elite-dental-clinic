/**
 * REAL-DATABASE integration tests.
 *
 * Unlike the unit tests (which mock Supabase or read the SQL as text), these apply the actual
 * migrations in `drizzle/migrations` to a real PostgreSQL server and exercise the behaviour that
 * the security model depends on: role privileges, RLS, the atomic booking RPC, race-safe
 * de-duplication, `FOR UPDATE SKIP LOCKED` job claiming and the shared rate limiter.
 *
 * Run:   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/clinic_test \
 *        npm run test:integration
 *
 * SAFETY: the test DROPS and recreates the `public` schema. It therefore refuses to run unless
 * the database name contains "test" as a whole word, the host is local (or
 * ALLOW_REMOTE_TEST_DB=1) and the host is not Supabase - see ./safety.ts. Never point it at the
 * production project.
 *
 * Supabase's `anon`, `authenticated` and `service_role` roles are created here when missing so
 * that a plain PostgreSQL (e.g. a CI service container) behaves like a Supabase project.
 *
 * Without TEST_DATABASE_URL the suite is skipped, unless REQUIRE_INTEGRATION=1 (set in CI), in
 * which case a missing URL fails the run instead of silently passing.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { assertSafeTestDatabase } from "./safety";

type Sql = ReturnType<typeof postgres>;
type Tx = postgres.TransactionSql;
type BrowserRole = "anon" | "authenticated" | "service_role";

const DATABASE_URL = process.env["TEST_DATABASE_URL"];
const REQUIRED = process.env["REQUIRE_INTEGRATION"] === "1";

const MIGRATIONS = [
  "0000_migration.sql",
  "0001_status_and_source.sql",
  "0002_security_hardening.sql",
  "0003_notification_outbox_and_status.sql",
  "0004_atomic_booking_and_outbox_claim.sql",
] as const;
const HARDENING_MIGRATION = "0005_revoke_public_function_execute.sql";
const CONSENT_MIGRATION = "0006_store_privacy_consent.sql";

const RPC_SIGNATURES = [
  "public.create_appointment_with_outbox(uuid,text,text,text,text,date,text,text,text,timestamptz,text)",
  "public.claim_notification_outbox_jobs(integer,integer)",
  "public.check_rate_limit(text,integer,integer)",
] as const;

const PERMISSION_DENIED = "42501";
const CHECK_VIOLATION = "23514";

function readMigration(file: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), "drizzle/migrations", file), "utf-8");
}

const BOOTSTRAP_SQL = `
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END
$$;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
`;

type BookingInput = {
  id?: string;
  name?: string;
  phone?: string;
  date?: string;
  time?: string;
  consentAt?: string | null;
  policyVersion?: string | null;
};

const suite = DATABASE_URL ? describe : REQUIRED ? describe : describe.skip;

suite("real PostgreSQL: migrations, permissions and RPCs", () => {
  let sql: Sql;
  let anonCouldExecuteBefore0005 = false;

  beforeAll(async () => {
    if (!DATABASE_URL) throw new Error("REQUIRE_INTEGRATION=1 but TEST_DATABASE_URL is not set");
    assertSafeTestDatabase(DATABASE_URL);

    sql = postgres(DATABASE_URL, { max: 10, onnotice: () => {} });
    await sql.unsafe(BOOTSTRAP_SQL);

    for (const file of MIGRATIONS) {
      await sql.unsafe(readMigration(file));
    }

    // Capture the pre-0005 state so the suite proves migration 0005 is what closes the hole.
    const [before] = await sql<{ open: boolean }[]>`
      SELECT has_function_privilege(
        'anon', 'public.check_rate_limit(text,integer,integer)', 'EXECUTE'
      ) AS open`;
    anonCouldExecuteBefore0005 = before?.open === true;

    // 0005 contains its own self-check and raises if anon/authenticated can still execute.
    await sql.unsafe(readMigration(HARDENING_MIGRATION));

    // 0006 replaces the booking RPC (new signature) and has its own self-check.
    await sql.unsafe(readMigration(CONSENT_MIGRATION));
  });

  afterAll(async () => {
    await sql?.end({ timeout: 5 });
  });

  beforeEach(async () => {
    await sql`TRUNCATE public.appointments, public.notification_outbox,
              public.rate_limit_buckets RESTART IDENTITY CASCADE`;
  });

  async function asRole<T>(role: BrowserRole, run: (tx: Tx) => Promise<T>): Promise<T> {
    const result = await sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL ROLE ${role}`);
      return run(tx);
    });
    return result as unknown as T;
  }

  async function book(input: BookingInput = {}): Promise<string> {
    const id = input.id ?? randomUUID();
    const [row] = await sql<{ id: string }[]>`
      SELECT public.create_appointment_with_outbox(
        ${id}::uuid,
        ${input.name ?? "Asha Test"}::text,
        ${input.phone ?? "+919147718046"}::text,
        ${null}::text,
        ${"Not specified"}::text,
        ${input.date ?? "2026-12-01"}::date,
        ${input.time ?? "Morning"}::text,
        ${null}::text,
        ${null}::text,
        ${input.consentAt === undefined ? "2026-10-26T20:00:00Z" : input.consentAt}::timestamptz,
        ${input.policyVersion === undefined ? "test-version" : input.policyVersion}::text
      ) AS id`;
    if (!row) throw new Error("RPC returned no row");
    return row.id;
  }

  async function count(table: "appointments" | "notification_outbox"): Promise<number> {
    const [row] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM ${sql(`public.${table}`)}`;
    return row?.n ?? -1;
  }

  describe("migrations", () => {
    it("apply cleanly in order and create the expected relations", async () => {
      const rows = await sql<{ table_name: string }[]>`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' ORDER BY table_name`;
      expect(rows.map((r) => r.table_name)).toEqual([
        "appointments",
        "notification_outbox",
        "rate_limit_buckets",
      ]);
    });

    it("0005 is necessary: before it, the default PUBLIC grant let anon execute the RPCs", () => {
      // If this ever becomes false the suite no longer proves 0005 does anything.
      expect(anonCouldExecuteBefore0005).toBe(true);
    });

    it("has row level security enabled on every table", async () => {
      const rows = await sql<{ relname: string; relrowsecurity: boolean }[]>`
        SELECT c.relname, c.relrowsecurity
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname`;
      expect(rows).toHaveLength(3);
      for (const row of rows) expect(row.relrowsecurity, row.relname).toBe(true);
    });
  });

  describe("browser roles are locked out", () => {
    it.each(["anon", "authenticated"] as const)("%s cannot read appointments", async (role) => {
      await expect(
        asRole(role, (tx) => tx`SELECT id FROM public.appointments`),
      ).rejects.toMatchObject({ code: PERMISSION_DENIED });
    });

    it.each(["anon", "authenticated"] as const)("%s cannot insert appointments", async (role) => {
      await expect(
        asRole(
          role,
          (tx) => tx`
            INSERT INTO public.appointments (name, phone, treatment, preferred_date, preferred_time)
            VALUES ('x', '123456', 'x', '2026-12-01', 'Morning')`,
        ),
      ).rejects.toMatchObject({ code: PERMISSION_DENIED });
    });

    it.each(["anon", "authenticated"] as const)(
      "%s cannot touch the outbox or rate-limit tables",
      async (role) => {
        await expect(
          asRole(role, (tx) => tx`SELECT * FROM public.notification_outbox`),
        ).rejects.toMatchObject({ code: PERMISSION_DENIED });
        await expect(
          asRole(role, (tx) => tx`SELECT * FROM public.rate_limit_buckets`),
        ).rejects.toMatchObject({ code: PERMISSION_DENIED });
      },
    );

    it("service_role can read and write", async () => {
      await book();
      const rows = await asRole("service_role", (tx) => tx`SELECT id FROM public.appointments`);
      expect(rows).toHaveLength(1);
    });
  });

  describe("RPC execute permissions (after 0005)", () => {
    it.each(["anon", "authenticated"] as const)(
      "%s cannot EXECUTE any of the SECURITY DEFINER functions",
      async (role) => {
        for (const signature of RPC_SIGNATURES) {
          const [row] = await sql<{ allowed: boolean }[]>`
            SELECT has_function_privilege(${role}::text, ${signature}::text, 'EXECUTE') AS allowed`;
          expect(row?.allowed, `${role} -> ${signature}`).toBe(false);
        }
      },
    );

    it("service_role can EXECUTE all of them", async () => {
      for (const signature of RPC_SIGNATURES) {
        const [row] = await sql<{ allowed: boolean }[]>`
          SELECT has_function_privilege('service_role', ${signature}, 'EXECUTE') AS allowed`;
        expect(row?.allowed, signature).toBe(true);
      }
    });

    it("an actual call as anon is rejected with permission denied, not executed", async () => {
      await expect(
        asRole("anon", (tx) => tx`SELECT public.check_rate_limit('probe', 1, 1)`),
      ).rejects.toMatchObject({ code: PERMISSION_DENIED });
      expect(await sql`SELECT 1 FROM public.rate_limit_buckets WHERE key = 'probe'`).toHaveLength(
        0,
      );
    });
  });

  describe("create_appointment_with_outbox", () => {
    it("creates the appointment and its pending outbox row together", async () => {
      const id = await book();

      const [appointment] = await sql<{ id: string; status: string }[]>`
        SELECT id, status FROM public.appointments`;
      expect(appointment).toMatchObject({ id, status: "new" });

      const [job] = await sql<{ appointment_id: string; status: string; attempts: number }[]>`
        SELECT appointment_id, status, attempts FROM public.notification_outbox`;
      expect(job).toMatchObject({ appointment_id: id, status: "pending", attempts: 0 });
    });

    it("stores the privacy consent time and policy version with the appointment", async () => {
      const id = await book({ consentAt: "2026-10-26T20:00:00Z", policyVersion: "2026-10-draft" });

      const [row] = await sql<{ at: Date; version: string }[]>`
        SELECT privacy_consent_at AS at, privacy_policy_version AS version
        FROM public.appointments WHERE id = ${id}`;
      expect(row?.at.toISOString()).toBe("2026-10-26T20:00:00.000Z");
      expect(row?.version).toBe("2026-10-draft");
    });

    it("leaves consent empty for bookings that have none (older rows are not invented)", async () => {
      const id = await book({ consentAt: null, policyVersion: null });

      const [row] = await sql<{ at: Date | null; version: string | null }[]>`
        SELECT privacy_consent_at AS at, privacy_policy_version AS version
        FROM public.appointments WHERE id = ${id}`;
      expect(row).toEqual({ at: null, version: null });
    });

    it("keeps exactly one version of the function: the old 9-argument one is gone", async () => {
      const rows = await sql<{ args: string }[]>`
        SELECT pg_get_function_identity_arguments(oid) AS args
        FROM pg_proc
        WHERE proname = 'create_appointment_with_outbox' AND pronamespace = 'public'::regnamespace`;
      expect(rows).toHaveLength(1);
      expect(rows[0]?.args).toContain("p_privacy_consent_at");
    });

    it("returns the existing id for a replay of the same slot within the window", async () => {
      const first = await book();
      const second = await book();

      expect(second).toBe(first);
      expect(await count("appointments")).toBe(1);
      expect(await count("notification_outbox")).toBe(1);
    });

    it("does not de-duplicate a different phone, date or time", async () => {
      await book();
      await book({ time: "Evening" });
      await book({ date: "2026-12-02" });
      await book({ phone: "+919000000001" });

      expect(await count("appointments")).toBe(4);
      expect(await count("notification_outbox")).toBe(4);
    });

    it("stores exactly one row when 10 identical requests race", async () => {
      const ids = await Promise.all(Array.from({ length: 10 }, () => book()));

      expect(new Set(ids).size).toBe(1);
      expect(await count("appointments")).toBe(1);
      expect(await count("notification_outbox")).toBe(1);
    });

    it("leaves nothing behind when the insert violates a table constraint", async () => {
      await expect(book({ name: "" })).rejects.toMatchObject({ code: CHECK_VIOLATION });

      expect(await count("appointments")).toBe(0);
      expect(await count("notification_outbox")).toBe(0);
    });
  });

  describe("claim_notification_outbox_jobs", () => {
    async function seedJobs(n: number): Promise<void> {
      for (let i = 0; i < n; i += 1) await book({ phone: `+91900000010${i}` });
    }

    async function claim(batch: number, staleMinutes = 10) {
      return sql<{ id: string; appointment_id: string; attempts: number; max_attempts: number }[]>`
        SELECT * FROM public.claim_notification_outbox_jobs(${batch}::int, ${staleMinutes}::int)`;
    }

    it("claims pending jobs and marks them processing", async () => {
      await seedJobs(3);
      const claimed = await claim(10);

      expect(claimed).toHaveLength(3);
      const rows = await sql<{ status: string }[]>`SELECT status FROM public.notification_outbox`;
      expect(rows.every((r) => r.status === "processing")).toBe(true);
      expect(await claim(10)).toHaveLength(0);
    });

    it("never hands the same job to two concurrent workers", async () => {
      await seedJobs(4);
      const [a, b] = await Promise.all([claim(2), claim(2)]);

      const ids = [...a, ...b].map((job) => job.id);
      expect(ids).toHaveLength(4);
      expect(new Set(ids).size).toBe(4);
    });

    it("respects the batch size", async () => {
      await seedJobs(5);
      expect(await claim(2)).toHaveLength(2);
    });

    it("reclaims a stale processing job but not a fresh one", async () => {
      await seedJobs(2);
      await claim(10); // both now 'processing' with updated_at = now()
      await sql`
        UPDATE public.notification_outbox SET updated_at = now() - interval '30 minutes'
        WHERE id = (SELECT id FROM public.notification_outbox ORDER BY created_at LIMIT 1)`;

      expect(await claim(10, 10)).toHaveLength(1);
    });

    it("skips exhausted jobs and jobs scheduled for later", async () => {
      await seedJobs(3);
      const rows = await sql<{ id: string }[]>`
        SELECT id FROM public.notification_outbox ORDER BY created_at`;
      await sql`UPDATE public.notification_outbox SET attempts = max_attempts
                WHERE id = ${rows[0]!.id}`;
      await sql`UPDATE public.notification_outbox
                SET next_attempt_at = now() + interval '1 hour' WHERE id = ${rows[1]!.id}`;

      const claimed = await claim(10);
      expect(claimed.map((j) => j.id)).toEqual([rows[2]!.id]);
    });
  });

  describe("check_rate_limit", () => {
    async function hit(key: string, max: number, windowSeconds = 60): Promise<boolean> {
      const [row] = await sql<{ ok: boolean }[]>`
        SELECT public.check_rate_limit(${key}, ${max}::int, ${windowSeconds}::int) AS ok`;
      return row?.ok === true;
    }

    it("allows up to the limit and then blocks", async () => {
      expect([await hit("ip-1", 3), await hit("ip-1", 3), await hit("ip-1", 3)]).toEqual([
        true,
        true,
        true,
      ]);
      expect(await hit("ip-1", 3)).toBe(false);
    });

    it("keeps keys independent", async () => {
      await hit("ip-a", 1);
      expect(await hit("ip-a", 1)).toBe(false);
      expect(await hit("ip-b", 1)).toBe(true);
    });

    it("starts a new window once the old one has expired", async () => {
      await hit("ip-2", 1);
      expect(await hit("ip-2", 1)).toBe(false);
      await sql`UPDATE public.rate_limit_buckets SET reset_at = now() - interval '1 second'
                WHERE key = 'ip-2'`;
      expect(await hit("ip-2", 1)).toBe(true);
    });

    it("counts correctly under concurrency", async () => {
      const results = await Promise.all(Array.from({ length: 12 }, () => hit("burst", 5)));
      expect(results.filter(Boolean)).toHaveLength(5);
    });
  });
});
