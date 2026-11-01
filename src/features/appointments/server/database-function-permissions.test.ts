/**
 * Regression tests for migration 0005 (revoke PUBLIC EXECUTE on SECURITY DEFINER functions).
 *
 * These are STATIC checks of the SQL text - they do not connect to a database. The migration itself
 * contains a self-verifying DO block, and docs/DEPLOYMENT.md lists the live checks (`has_function_privilege`
 * and an anon-key RPC call) that must be run against the real Supabase project.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Read a migration with `-- line comments` removed so prose never satisfies (or trips) a pattern. */
const read = (file: string) =>
  fs
    .readFileSync(path.resolve(process.cwd(), "drizzle/migrations", file), "utf-8")
    .replace(/--.*$/gm, "");

const FUNCTIONS = [
  "create_appointment_with_outbox",
  "claim_notification_outbox_jobs",
  "check_rate_limit",
] as const;

describe("0005_revoke_public_function_execute.sql", () => {
  const sql0004 = read("0004_atomic_booking_and_outbox_claim.sql");
  const sql0005 = read("0005_revoke_public_function_execute.sql");

  it("covers every SECURITY DEFINER function created by 0004", () => {
    for (const fn of FUNCTIONS) {
      expect(sql0004).toMatch(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\(`));
    }
    expect(sql0004.match(/SECURITY DEFINER/g)?.length).toBe(FUNCTIONS.length);
  });

  it.each(FUNCTIONS)("revokes EXECUTE on %s from PUBLIC, anon and authenticated", (fn) => {
    const pattern = new RegExp(
      `REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+public\\.${fn}\\([^)]*\\)\\s+FROM\\s+PUBLIC\\s*,\\s*anon\\s*,\\s*authenticated\\s*;`,
      "i",
    );
    expect(sql0005).toMatch(pattern);
  });

  it.each(FUNCTIONS)("grants EXECUTE on %s only to service_role", (fn) => {
    const grants = [
      ...sql0005.matchAll(
        new RegExp(
          `GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${fn}\\([^)]*\\)\\s+TO\\s+(\\w+)\\s*;`,
          "gi",
        ),
      ),
    ].map((m) => m[1]);
    expect(grants).toEqual(["service_role"]);
  });

  it("never re-grants anything to PUBLIC, anon or authenticated", () => {
    expect(sql0005).not.toMatch(/GRANT[^;]*\bTO\s+(?:PUBLIC|anon|authenticated)\b/i);
  });

  it("aborts the migration if browser roles can still execute the functions", () => {
    expect(sql0005).toMatch(/has_function_privilege\('anon'/);
    expect(sql0005).toMatch(/has_function_privilege\('authenticated'/);
    expect(sql0005).toMatch(/RAISE EXCEPTION/);
  });
});

describe("0006_store_privacy_consent.sql", () => {
  const sql0006 = read("0006_store_privacy_consent.sql");
  const NEW_SIGNATURE =
    "uuid,\\s*text,\\s*text,\\s*text,\\s*text,\\s*date,\\s*text,\\s*text,\\s*text,\\s*timestamptz,\\s*text";

  it("adds both consent columns as nullable (old rows have no consent record)", () => {
    expect(sql0006).toMatch(/ADD COLUMN IF NOT EXISTS privacy_consent_at timestamptz\s*,/);
    expect(sql0006).toMatch(/ADD COLUMN IF NOT EXISTS privacy_policy_version text\s*;/);
    // Only the ALTER TABLE statement matters here (the function body legitimately uses IS NOT NULL).
    const alterStatement = /ALTER TABLE public\.appointments[^;]*;/.exec(sql0006)?.[0] ?? "";
    expect(alterStatement).not.toMatch(/\bNOT NULL\b/i);
  });

  it("drops the old 9-argument function so only one version exists", () => {
    expect(sql0006).toMatch(
      /DROP FUNCTION IF EXISTS public\.create_appointment_with_outbox\(\s*uuid,\s*text,\s*text,\s*text,\s*text,\s*date,\s*text,\s*text,\s*text\s*\)/,
    );
  });

  it("revokes PUBLIC/anon/authenticated and grants only service_role on the new signature", () => {
    expect(sql0006).toMatch(
      new RegExp(
        `REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+public\\.create_appointment_with_outbox\\(\\s*${NEW_SIGNATURE}\\s*\\)\\s+FROM\\s+PUBLIC\\s*,\\s*anon\\s*,\\s*authenticated\\s*;`,
        "i",
      ),
    );
    const grants = [
      ...sql0006.matchAll(/GRANT\s+EXECUTE\s+ON\s+FUNCTION[^;]*TO\s+(\w+)\s*;/gi),
    ].map((m) => m[1]);
    expect(grants).toEqual(["service_role"]);
  });

  it("contains a self-check that aborts the migration", () => {
    expect(sql0006).toMatch(/has_function_privilege\('anon'/);
    expect(sql0006).toMatch(/RAISE EXCEPTION/);
  });
});
