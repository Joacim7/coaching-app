-- ── Contact info & app access on profiles ────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone      TEXT,
  ADD COLUMN IF NOT EXISTS app_access BOOLEAN NOT NULL DEFAULT TRUE;

-- ── Allow coaches to update their clients' profiles ───────────────────────────
-- The existing UPDATE policy only covers id = auth.uid() (own profile).
-- Coaches need to edit contact info and app_access for their clients.
DROP POLICY IF EXISTS "Coaches can update their clients profiles" ON public.profiles;
CREATE POLICY "Coaches can update their clients profiles"
  ON public.profiles FOR UPDATE
  USING  (public.is_my_client(id))
  WITH CHECK (public.is_my_client(id));
