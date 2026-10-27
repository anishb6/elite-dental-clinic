/**
 * Safety guard for the real-database integration suite, which DROPS the `public` schema.
 *
 * A target is accepted only when ALL of these hold:
 *  - the database name contains the word "test" as a whole token (`clinic_test`, `test`,
 *    `test-db`) - not as a substring of another word (`latest`, `contest`);
 *  - the host is local (localhost, 127.0.0.0/8, ::1), unless ALLOW_REMOTE_TEST_DB=1 is set;
 *  - the host is never a Supabase host, even when ALLOW_REMOTE_TEST_DB=1.
 */
const LOCAL_HOSTS = /^(localhost|127(\.\d{1,3}){3}|\[?::1\]?)$/i;
const TEST_TOKEN = /(^|[^a-z0-9])test([^a-z0-9]|$)/i;

export type TargetCheck = { ok: true } | { ok: false; reason: string };

export function checkTestDatabaseTarget(
  url: string,
  options: { allowRemote?: boolean } = {},
): TargetCheck {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "TEST_DATABASE_URL is not a valid URL" };
  }

  if (!/^postgres(ql)?:$/i.test(parsed.protocol)) {
    return { ok: false, reason: "TEST_DATABASE_URL must be a postgres:// URL" };
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!TEST_TOKEN.test(database)) {
    return {
      ok: false,
      reason: `database "${database}" must contain "test" as a whole word (e.g. clinic_test)`,
    };
  }

  const host = parsed.hostname;
  if (/(^|\.)supabase\.(co|com|net)$/i.test(host) || /supabase/i.test(host)) {
    return { ok: false, reason: "refusing to run against a Supabase host" };
  }

  if (!LOCAL_HOSTS.test(host) && !options.allowRemote) {
    return {
      ok: false,
      reason: `host "${host}" is not local; set ALLOW_REMOTE_TEST_DB=1 only for a disposable server`,
    };
  }

  return { ok: true };
}

export function assertSafeTestDatabase(url: string): void {
  const result = checkTestDatabaseTarget(url, {
    allowRemote: process.env["ALLOW_REMOTE_TEST_DB"] === "1",
  });
  if (!result.ok) {
    throw new Error(
      `Refusing to run integration tests (they drop the public schema): ${result.reason}`,
    );
  }
}
