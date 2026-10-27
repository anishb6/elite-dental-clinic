-- 0002_security_hardening.sql
-- Security hardening: Remove public direct access to appointments
--
-- NOTE: Reviewable migration file created for repository audit.
-- Per project safety rules, this migration is NOT automatically applied to production.
-- The database administrator / owner should review and apply it in Supabase SQL editor.
--
-- Migration History:
-- - 0000_migration.sql: Granted public INSERT on appointments to anon/authenticated.
-- - 0001_status_and_source.sql: Added status & source columns, constrained INSERT with status='new'.
-- - 0002_security_hardening.sql: Revokes ALL direct client access (INSERT, SELECT, UPDATE, DELETE)
--   from public roles (anon and authenticated). Appointment creation now occurs strictly through
--   the secure server-side endpoint (/api/create-appointment) using the service_role key.

-- 1. Performance indexes for operational queries
CREATE INDEX IF NOT EXISTS idx_appointments_created_at
  ON public.appointments (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_appointments_preferred_date
  ON public.appointments (preferred_date);

CREATE INDEX IF NOT EXISTS idx_appointments_status
  ON public.appointments (status);

-- 2. Remove obsolete public INSERT policy
DROP POLICY IF EXISTS "Anyone can request an appointment" ON public.appointments;

-- 3. Revoke all privileges from public browser roles (anon and authenticated)
-- Direct client access from the browser is completely disabled.
-- Clients cannot bypass server validation, rate limiting, or bot protection.
REVOKE ALL PRIVILEGES ON TABLE public.appointments FROM anon, authenticated;

-- 4. Ensure privileged server-side access is granted to service_role
GRANT ALL ON TABLE public.appointments TO service_role;

-- 5. Confirm RLS is enabled
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
