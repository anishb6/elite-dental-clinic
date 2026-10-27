-- verify_permissions.sql
-- Run this in the Supabase Dashboard SQL Editor to inspect effective table grants,
-- row-level security (RLS) policies, and schema constraints.
--
-- This script performs READ-ONLY verification queries and does not modify data.

-- 1. Check Table Privileges for appointments and notification_outbox
SELECT 
  grantee, 
  table_schema, 
  table_name, 
  privilege_type
FROM information_schema.role_table_grants
WHERE table_name IN ('appointments', 'notification_outbox', 'rate_limit_buckets')
  AND table_schema = 'public'
ORDER BY table_name, grantee, privilege_type;

-- EXPECTED RESULT:
-- - `service_role` has ALL privileges (SELECT, INSERT, UPDATE, DELETE).
-- - `anon` and `authenticated` have ZERO privileges.

-- 2. Check Row Level Security (RLS) Status
SELECT 
  schemaname, 
  tablename, 
  rowsecurity 
FROM pg_tables
WHERE tablename IN ('appointments', 'notification_outbox')
  AND schemaname = 'public';

-- EXPECTED RESULT:
-- - `rowsecurity` is true for both `appointments` and `notification_outbox`.

-- 3. Check Effective RLS Policies
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual, 
  with_check
FROM pg_policies
WHERE tablename IN ('appointments', 'notification_outbox')
  AND schemaname = 'public';

-- EXPECTED RESULT:
-- - No permissive policies for `anon` or `authenticated`.
-- - Any direct client requests without service_role key will be rejected with 42501 (insufficient privilege).

-- 4. Check Check Constraints on status
SELECT 
  conname AS constraint_name, 
  pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE conrelid = 'public.appointments'::regclass
  AND contype = 'c';

-- 5. Check Routine (Function) Execute Privileges
SELECT 
  routine_name, 
  grantee, 
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN ('create_appointment_with_outbox', 'claim_notification_outbox_jobs', 'check_rate_limit')
ORDER BY routine_name, grantee;

-- EXPECTED RESULT:
-- - `service_role` has EXECUTE.
-- - `anon` and `authenticated` have NO privileges.

-- EXPECTED RESULT:
-- - `appointments_status_check` constraint matches ('new', 'called', 'confirmed', 'visited', 'completed', 'no_show', 'cancelled').
