-- 0003_notification_outbox_and_status.sql
-- Adds durable notification outbox table and expands appointment status constraints
--
-- NOTE: Reviewable migration file created for repository audit.
-- Per project safety rules, this migration is NOT automatically applied to production.
-- The database administrator / owner should review and apply it in Supabase SQL editor.
--
-- Migration History:
-- - 0000_migration.sql: Initial appointments table
-- - 0001_status_and_source.sql: Added status & source columns, constrained status check
-- - 0002_security_hardening.sql: Revoked public access (anon/authenticated), enabled RLS, indexes
-- - 0003_notification_outbox_and_status.sql: Durable notification outbox & status updates

-- 1. Create notification outbox table for durable email dispatch
CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_notification_outbox_appointment UNIQUE (appointment_id)
);

-- 2. Indexes for operational outbox queries
CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending
  ON public.notification_outbox (status, next_attempt_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_notification_outbox_appointment
  ON public.notification_outbox (appointment_id);

-- 3. Security: Revoke direct client access and grant to service_role
REVOKE ALL PRIVILEGES ON TABLE public.notification_outbox FROM anon, authenticated;
GRANT ALL ON TABLE public.notification_outbox TO service_role;
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;

-- 4. Align appointments status check constraint to support 'completed' alongside 'visited'
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('new', 'called', 'confirmed', 'visited', 'completed', 'no_show', 'cancelled'));
