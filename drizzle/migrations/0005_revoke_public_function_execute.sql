-- 0005_revoke_public_function_execute.sql
-- Close the PUBLIC EXECUTE hole on the SECURITY DEFINER functions created in 0004.
--
-- NOTE: Reviewable migration file. Like 0002-0004 it is NOT applied automatically.
-- The database owner must review and apply it (Supabase SQL editor), AFTER 0004.
--
-- Why this is needed:
--   PostgreSQL grants EXECUTE on every new function to the PUBLIC pseudo-role by default, and
--   `anon` / `authenticated` inherit it. `REVOKE ... FROM anon, authenticated` (as used in 0004)
--   does NOT remove that PUBLIC grant. Until it is removed, anyone holding the public anon key can
--   call these functions through the Supabase REST API (/rest/v1/rpc/...), which would let them:
--     - create_appointment_with_outbox: create bookings without the server's Turnstile check,
--       honeypot, validation and rate limit;
--     - claim_notification_outbox_jobs: steal / stall notification jobs;
--     - check_rate_limit: burn another visitor's rate-limit bucket (e.g. a victim's IP key).
--   After this migration only `service_role` (the server) may execute them.
--
-- Idempotent: safe to run more than once.

REVOKE ALL ON FUNCTION public.create_appointment_with_outbox(
  uuid, text, text, text, text, date, text, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_appointment_with_outbox(
  uuid, text, text, text, text, date, text, text, text
) TO service_role;

REVOKE ALL ON FUNCTION public.claim_notification_outbox_jobs(integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_outbox_jobs(integer, integer)
  TO service_role;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer)
  TO service_role;

-- Self-verifying: abort (and roll back) if any browser-facing role can still execute them,
-- or if the server role lost access.
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.create_appointment_with_outbox(uuid,text,text,text,text,date,text,text,text)',
    'public.claim_notification_outbox_jobs(integer,integer)',
    'public.check_rate_limit(text,integer,integer)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    IF has_function_privilege('anon', fn, 'EXECUTE')
       OR has_function_privilege('authenticated', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'Migration 0005 failed: anon/authenticated can still EXECUTE %', fn;
    END IF;
    IF NOT has_function_privilege('service_role', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'Migration 0005 failed: service_role cannot EXECUTE %', fn;
    END IF;
  END LOOP;
END
$$;
