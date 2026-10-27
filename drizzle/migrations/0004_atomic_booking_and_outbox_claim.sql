-- 0004_atomic_booking_and_outbox_claim.sql
-- Atomic appointment creation with outbox enqueueing, race-safe deduplication,
-- atomic queue claiming with concurrency locking, and shared rate-limiting.
--
-- NOTE: Reviewable migration file created for repository audit.
-- Per project safety rules, this migration is NOT automatically applied to production.
-- The database administrator / owner should review and apply it in Supabase SQL editor.
--
-- Migration History:
-- - 0000_migration.sql: Initial appointments table
-- - 0001_status_and_source.sql: Added status & source columns, constrained status check
-- - 0002_security_hardening.sql: Revoked public access (anon/authenticated), enabled RLS, indexes
-- - 0003_notification_outbox_and_status.sql: Notification outbox table & status constraints
-- - 0004_atomic_booking_and_outbox_claim.sql: Atomic single-transaction RPCs, race-safe deduplication,
--   FOR UPDATE SKIP LOCKED queue claiming, and shared rate-limiting table.

-- 1. Index for fast duplicate / replay lookup across multiple server instances
CREATE INDEX IF NOT EXISTS idx_appointments_dedup
  ON public.appointments (phone, preferred_date, preferred_time, created_at DESC);

-- Index for detecting stale processing jobs
CREATE INDEX IF NOT EXISTS idx_notification_outbox_stale
  ON public.notification_outbox (status, updated_at)
  WHERE status = 'processing';

-- 2. Atomic Appointment Creation + Outbox Enqueueing + Race-Safe Deduplication
-- Uses PostgreSQL transaction-level advisory lock (pg_advisory_xact_lock) to serialize
-- concurrent submissions for the exact same (phone, date, time) combination across all server instances.
-- If an identical booking exists within the 2-minute replay window, returns the existing ID without duplicate insert.
-- Ensures an appointment record is NEVER created without a corresponding notification outbox entry.
CREATE OR REPLACE FUNCTION public.create_appointment_with_outbox(
  p_id uuid,
  p_name text,
  p_phone text,
  p_email text,
  p_treatment text,
  p_preferred_date date,
  p_preferred_time text,
  p_message text,
  p_source text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
BEGIN
  -- 1. Acquire transaction-level advisory lock on hash of (phone, date, time).
  -- Serializes simultaneous requests for the exact same booking slot across all instances.
  -- The lock is automatically released upon transaction COMMIT or ROLLBACK.
  PERFORM pg_advisory_xact_lock(hashtext(p_phone || ':' || p_preferred_date::text || ':' || p_preferred_time));

  -- 2. Race-safe duplicate check within 2-minute window under the advisory lock
  SELECT id INTO v_existing_id
  FROM public.appointments
  WHERE phone = p_phone
    AND preferred_date = p_preferred_date
    AND preferred_time = p_preferred_time
    AND created_at >= (now() - interval '2 minutes')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Return existing ID so application returns duplicate response without re-inserting
    RETURN v_existing_id;
  END IF;

  -- 3. Insert into appointments table
  INSERT INTO public.appointments (
    id,
    name,
    phone,
    email,
    treatment,
    preferred_date,
    preferred_time,
    message,
    source,
    status
  ) VALUES (
    p_id,
    p_name,
    p_phone,
    p_email,
    p_treatment,
    p_preferred_date,
    p_preferred_time,
    p_message,
    p_source,
    'new'
  );

  -- 4. Insert into notification_outbox in the same single transaction
  INSERT INTO public.notification_outbox (
    appointment_id,
    status,
    attempts,
    max_attempts,
    next_attempt_at,
    created_at,
    updated_at
  ) VALUES (
    p_id,
    'pending',
    0,
    5,
    now(),
    now(),
    now()
  )
  ON CONFLICT (appointment_id) DO NOTHING;

  RETURN p_id;
END;
$$;

-- Secure permissions: Restricted strictly to trusted server service_role
REVOKE ALL ON FUNCTION public.create_appointment_with_outbox FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_appointment_with_outbox TO service_role;

-- 3. Atomic Outbox Job Claiming with FOR UPDATE SKIP LOCKED
-- Eliminates race conditions across multiple concurrent server workers / cron triggers.
-- Automatically reclaims stale 'processing' jobs if a worker died midway.
CREATE OR REPLACE FUNCTION public.claim_notification_outbox_jobs(
  p_batch_size int DEFAULT 20,
  p_stale_minutes int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  appointment_id uuid,
  attempts integer,
  max_attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimable AS (
    SELECT o.id
    FROM public.notification_outbox o
    WHERE (
      (o.status IN ('pending', 'failed') AND o.next_attempt_at <= now() AND o.attempts < o.max_attempts)
      OR
      (o.status = 'processing' AND o.updated_at < now() - (p_stale_minutes || ' minutes')::interval)
    )
    ORDER BY o.next_attempt_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.notification_outbox o
  SET status = 'processing',
      updated_at = now()
  FROM claimable
  WHERE o.id = claimable.id
  RETURNING o.id, o.appointment_id, o.attempts, o.max_attempts;
END;
$$;

-- Secure permissions: Restricted strictly to trusted server service_role
REVOKE ALL ON FUNCTION public.claim_notification_outbox_jobs FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_outbox_jobs TO service_role;

-- 4. Shared Multi-Instance Rate Limiting
-- In distributed multi-instance deployments, provides a central sliding-window rate limit
-- in PostgreSQL across all application instances.
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 1,
  reset_at timestamptz NOT NULL
);

REVOKE ALL ON TABLE public.rate_limit_buckets FROM anon, authenticated;
GRANT ALL ON TABLE public.rate_limit_buckets TO service_role;
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text,
  p_max integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Periodically prune expired buckets
  DELETE FROM public.rate_limit_buckets WHERE reset_at < now();

  INSERT INTO public.rate_limit_buckets (key, count, reset_at)
  VALUES (p_key, 1, now() + (p_window_seconds || ' seconds')::interval)
  ON CONFLICT (key) DO UPDATE
  SET count = CASE
        WHEN public.rate_limit_buckets.reset_at < now() THEN 1
        ELSE public.rate_limit_buckets.count + 1
      END,
      reset_at = CASE
        WHEN public.rate_limit_buckets.reset_at < now() THEN now() + (p_window_seconds || ' seconds')::interval
        ELSE public.rate_limit_buckets.reset_at
      END
  RETURNING count INTO v_count;

  RETURN v_count <= p_max;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit TO service_role;
