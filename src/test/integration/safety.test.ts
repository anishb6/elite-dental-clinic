import { describe, expect, it } from "vitest";
import { checkTestDatabaseTarget } from "./safety";

const ok = (url: string, allowRemote = false) => checkTestDatabaseTarget(url, { allowRemote }).ok;

describe("integration-test database safety guard", () => {
  it.each([
    "postgres://postgres:postgres@localhost:5432/clinic_test",
    "postgresql://u:p@127.0.0.1:5432/test",
    "postgres://u:p@[::1]:5432/test-db",
    "postgres://u:p@localhost/clinic_test?sslmode=disable",
  ])("accepts a local disposable database: %s", (url) => {
    expect(ok(url)).toBe(true);
  });

  it.each([
    "postgres://u:p@localhost:5432/postgres",
    "postgres://u:p@localhost:5432/clinic",
    "postgres://u:p@localhost:5432/latest",
    "postgres://u:p@localhost:5432/contest_prod",
    "postgres://u:p@localhost:5432/",
  ])("rejects a database name without a whole-word 'test': %s", (url) => {
    expect(ok(url)).toBe(false);
  });

  it.each([
    "postgres://postgres:pw@db.abcdefghijkl.supabase.co:5432/clinic_test",
    "postgres://postgres.abc:pw@aws-0-ap-south-1.pooler.supabase.com:6543/clinic_test",
  ])("rejects Supabase hosts even with a test-like name and allowRemote: %s", (url) => {
    expect(ok(url)).toBe(false);
    expect(ok(url, true)).toBe(false);
  });

  it("rejects non-local hosts unless remote is explicitly allowed", () => {
    const url = "postgres://u:p@db.internal.example.com:5432/clinic_test";
    expect(ok(url)).toBe(false);
    expect(ok(url, true)).toBe(true);
  });

  it("rejects malformed or non-postgres URLs", () => {
    expect(ok("not a url")).toBe(false);
    expect(ok("https://localhost/clinic_test")).toBe(false);
  });
});
