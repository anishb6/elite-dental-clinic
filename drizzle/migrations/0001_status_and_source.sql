-- Track what happens to each booking request, and how the patient found the clinic.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'called', 'confirmed', 'visited', 'no_show', 'cancelled')),
  ADD COLUMN IF NOT EXISTS source text CHECK (source IS NULL OR char_length(source) <= 40);

-- Public visitors may only create requests with status 'new'; they can't set it to anything else.
DROP POLICY IF EXISTS "Anyone can request an appointment" ON public.appointments;
CREATE POLICY "Anyone can request an appointment" ON public.appointments
  FOR INSERT TO anon, authenticated WITH CHECK (status = 'new');
