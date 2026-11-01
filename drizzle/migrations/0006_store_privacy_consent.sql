-- 0006_store_privacy_consent.sql
-- Record WHEN a patient gave privacy consent and WHICH version of the notice they agreed to.
--
-- NOTE: Reviewable migration file. Like 0002-0005 it is NOT applied automatically.
-- The database owner must review and apply it (Supabase SQL editor), AFTER 0005.
--
-- Why: the booking form requires an explicit consent tick and the server rejects a booking without
-- it, but until now nothing was saved, so the clinic could not show that consent was given.
--
-- Changes:
--   1. Two nullable columns on public.appointments. Nullable because bookings made before this
--      migration have no consent record, and we must not invent one for them.
--   2. create_appointment_with_outbox gains two parameters and stores them. The old 9-argument
--      version is dropped, so exactly one version of the function exists afterwards (otherwise an
--      old caller could silently keep using the version that stores no consent).
--   3. The new signature gets the same permissions as 0005 set for the old one: only service_role.
--
-- Deploy order: apply this migration BEFORE deploying the application code that calls the new
-- signature. Until it is applied, bookings from the new code fail with "function does not exist".

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS privacy_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_policy_version text;

DROP FUNCTION IF EXISTS public.create_appointment_with_outbox(
  uuid, text, text, text, text, date, text, text, text
);

-- Same logic as 0004 (advisory lock, 2-minute duplicate window, appointment + outbox row in one
-- transaction); the only difference is the two consent columns.
CREATE FUNCTION public.create_appointment_with_outbox(
  p_id uuid,
  p_name text,
  p_phone text,
  p_email text,
  p_treatment text,
  p_preferred_date date,
  p_preferred_time text,
  p_message text,
  p_source text,
  p_privacy_consent_at timestamptz,
  p_privacy_policy_version text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_phone || ':' || p_preferred_date::text || ':' || p_preferred_time));

  SELECT id INTO v_existing_id
  FROM public.appointments
  WHERE phone = p_phone
    AND preferred_date = p_preferred_date
    AND preferred_time = p_preferred_time
    AND created_at >= (now() - interval '2 minutes')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  INSERT INTO public.appointments (
    id, name, phone, email, treatment, preferred_date, preferred_time, message, source, status,
    privacy_consent_at, privacy_policy_version
  ) VALUES (
    p_id, p_name, p_phone, p_email, p_treatment, p_preferred_date, p_preferred_time, p_message,
    p_source, 'new', p_privacy_consent_at, p_privacy_policy_version
  );

  INSERT INTO public.notification_outbox (
    appointment_id, status, attempts, max_attempts, next_attempt_at, created_at, updated_at
  ) VALUES (
    p_id, 'pending', 0, 5, now(), now(), now()
  )
  ON CONFLICT (appointment_id) DO NOTHING;

  RETURN p_id;
END;
$$;

-- PostgreSQL grants EXECUTE to PUBLIC on every new function (see 0005), so revoke it explicitly.
REVOKE ALL ON FUNCTION public.create_appointment_with_outbox(
  uuid, text, text, text, text, date, text, text, text, timestamptz, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_appointment_with_outbox(
  uuid, text, text, text, text, date, text, text, text, timestamptz, text
) TO service_role;

-- Self-verifying: abort (and roll back) unless exactly one version exists and only the server role
-- can execute it.
DO $$
DECLARE
  fn text := 'public.create_appointment_with_outbox(uuid,text,text,text,text,date,text,text,text,timestamptz,text)';
  versions integer;
BEGIN
  SELECT count(*) INTO versions
  FROM pg_proc
  WHERE proname = 'create_appointment_with_outbox'
    AND pronamespace = 'public'::regnamespace;
  IF versions <> 1 THEN
    RAISE EXCEPTION 'Migration 0006 failed: expected 1 create_appointment_with_outbox function, found %', versions;
  END IF;

  IF has_function_privilege('anon', fn, 'EXECUTE')
     OR has_function_privilege('authenticated', fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'Migration 0006 failed: anon/authenticated can still EXECUTE %', fn;
  END IF;
  IF NOT has_function_privilege('service_role', fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'Migration 0006 failed: service_role cannot EXECUTE %', fn;
  END IF;
END
$$;
