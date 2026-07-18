-- ── Add 'onboarding' form type ────────────────────────────────────────────────

-- Extend the type check on checkin_templates (Postgres auto-named the constraint)
DO $$
DECLARE r TEXT;
BEGIN
  SELECT conname INTO r
  FROM pg_constraint
  WHERE conrelid = 'public.checkin_templates'::regclass
    AND contype  = 'c'
    AND pg_get_constraintdef(oid) LIKE '%daily%';
  IF r IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.checkin_templates DROP CONSTRAINT %I', r);
  END IF;
END $$;

ALTER TABLE public.checkin_templates
  ADD CONSTRAINT checkin_templates_type_check
  CHECK (type IN ('daily', 'weekly', 'onboarding'));

-- Same for checkins table
DO $$
DECLARE r TEXT;
BEGIN
  SELECT conname INTO r
  FROM pg_constraint
  WHERE conrelid = 'public.checkins'::regclass
    AND contype  = 'c'
    AND pg_get_constraintdef(oid) LIKE '%daily%';
  IF r IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.checkins DROP CONSTRAINT %I', r);
  END IF;
END $$;

ALTER TABLE public.checkins
  ADD CONSTRAINT checkins_type_check
  CHECK (type IN ('daily', 'weekly', 'onboarding'));

-- ── Add email + onboarding token to profiles ──────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email            TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_onboarding_token
  ON public.profiles(onboarding_token);

-- ── Onboarding submissions (public form → stored here, not in checkins) ───────
-- A separate table avoids the auth.uid() requirement on the checkins RLS policy.
-- The onboarding_token in the URL acts as a bearer token identifying the client.
CREATE TABLE IF NOT EXISTS public.onboarding_submissions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id  UUID        REFERENCES public.checkin_templates(id) ON DELETE SET NULL,
  answers      JSONB       NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.onboarding_submissions ENABLE ROW LEVEL SECURITY;

-- The form page submits without auth — token in URL is the only auth mechanism
CREATE POLICY "allow_onboarding_insert"
  ON public.onboarding_submissions FOR INSERT
  WITH CHECK (true);

-- Coaches can view submissions for their clients
CREATE POLICY "coaches_view_onboarding_submissions"
  ON public.onboarding_submissions FOR SELECT
  USING (public.is_my_client(client_id));

CREATE INDEX IF NOT EXISTS idx_onboarding_submissions_client
  ON public.onboarding_submissions(client_id);
