-- Leads: prospects who have not yet been converted to clients.
-- Created manually by the coach or automatically when someone submits
-- a public oppstartsskjema at /start/[coachId].

CREATE TABLE IF NOT EXISTS public.leads (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name    TEXT        NOT NULL,
  email        TEXT,
  phone        TEXT,
  status       TEXT        NOT NULL DEFAULT 'ny'
               CHECK (status IN ('ny', 'kontaktet', 'kvalifisert', 'vunnet', 'tapt')),
  source       TEXT        NOT NULL DEFAULT 'manual',
  notes        TEXT,
  form_answers JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Coaches can do everything with their own leads
CREATE POLICY "coaches_manage_own_leads" ON public.leads
  FOR ALL
  USING     (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());
