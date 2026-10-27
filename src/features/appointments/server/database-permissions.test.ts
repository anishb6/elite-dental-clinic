/**
 * Database permissions and RLS policy verification tests.
 *
 * IMPORTANT DISTINCTION:
 * - These unit tests verify the static SQL migration definitions and client data flow.
 * - They prove that the codebase revokes public client privileges and routes all operations
 *   through trusted server-side service_role execution.
 * - These tests are MOCKED and DO NOT connect to a live Supabase or PostgreSQL database.
 * - Real PostgreSQL Row Level Security (RLS) enforcement must be verified in the real
 *   Supabase environment after the database administrator applies 0002_security_hardening.sql.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

describe("Database permissions & migration hardening (0002_security_hardening.sql)", () => {
  const migrationPath = path.resolve(
    process.cwd(),
    "drizzle/migrations/0002_security_hardening.sql",
  );

  it("exists and is readable", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  it("revokes all privileges from public browser roles (anon and authenticated)", () => {
    const sql = fs.readFileSync(migrationPath, "utf-8");

    // Must revoke all table privileges so clients cannot bypass server validation
    expect(sql).toMatch(
      /REVOKE\s+ALL\s+PRIVILEGES\s+ON\s+TABLE\s+public\.appointments\s+FROM\s+anon,\s*authenticated;/i,
    );
  });

  it("drops obsolete public INSERT policies", () => {
    const sql = fs.readFileSync(migrationPath, "utf-8");

    // Must remove "Anyone can request an appointment" policy created in 0000 & 0001
    expect(sql).toMatch(
      /DROP\s+POLICY\s+IF\s+EXISTS\s+"Anyone can request an appointment"\s+ON\s+public\.appointments;/i,
    );
  });

  it("grants full access strictly to service_role and enables RLS", () => {
    const sql = fs.readFileSync(migrationPath, "utf-8");

    // Server endpoints using service_role retain necessary access
    expect(sql).toMatch(/GRANT\s+ALL\s+ON\s+TABLE\s+public\.appointments\s+TO\s+service_role;/i);
    expect(sql).toMatch(/ALTER\s+TABLE\s+public\.appointments\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY;/i);
  });

  it("does not grant any insert or select privileges to public roles", () => {
    const sql = fs.readFileSync(migrationPath, "utf-8");

    // Ensure no accidental grants remain in the hardening migration
    expect(sql).not.toMatch(
      /GRANT\s+INSERT\s+ON\s+public\.appointments\s+TO\s+(?:anon|authenticated)/i,
    );
    expect(sql).not.toMatch(
      /GRANT\s+SELECT\s+ON\s+public\.appointments\s+TO\s+(?:anon|authenticated)/i,
    );
  });
});

describe("Client data access architecture (preventing direct browser DB access)", () => {
  it("verifies appointments.api.ts routes creation to server endpoint, not direct Supabase client", () => {
    const apiFilePath = path.resolve(
      process.cwd(),
      "src/features/appointments/api/appointments.api.ts",
    );
    const code = fs.readFileSync(apiFilePath, "utf-8");

    // Browser code must NOT import public supabase client or perform direct DB calls
    expect(code).not.toContain('@/integrations/supabase/client"');
    expect(code).not.toContain("supabase.from(");
    expect(code).toContain("apiRequest");
    expect(code).toContain("CREATE_APPOINTMENT_ENDPOINT");
  });

  it("simulates RLS rejection when a public role attempts direct insertion (contract test)", async () => {
    // Mocked contract demonstration:
    // When public role lacks INSERT policy and privileges, Supabase/PostgreSQL returns 42501 (insufficient_privilege)
    const mockAnonClient = {
      from: vi.fn((_table: string) => ({
        insert: vi.fn((_payload: unknown) =>
          Promise.resolve({
            data: null,
            error: {
              code: "42501",
              message: "permission denied for table appointments",
              details: null,
              hint: null,
            },
          }),
        ),
      })),
    };

    const result = await mockAnonClient.from("appointments").insert({
      name: "Attacker",
      phone: "+919876543210",
      preferred_date: "2026-11-01",
      preferred_time: "Morning",
    });

    expect(result.error).not.toBeNull();
    expect(result.error?.code).toBe("42501");
    expect(result.error?.message).toContain("permission denied");
  });
});
