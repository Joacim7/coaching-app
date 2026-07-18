-- ============================================================
-- CLIENT PHASES + CHECK-IN METRICS
-- ============================================================

-- Coach-defined phases in a client's journey (e.g. "Vektnedgang", "Vedlikehold")
CREATE TABLE IF NOT EXISTS public.client_phases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#3b82f6',
  start_date  DATE NOT NULL,
  end_date    DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can manage their client phases"
  ON public.client_phases FOR ALL
  USING (coach_id = auth.uid());

CREATE POLICY "Clients can view their own phases"
  ON public.client_phases FOR SELECT
  USING (client_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_client_phases_client ON public.client_phases(client_id, start_date);

-- Standardised numeric metrics on each check-in.
-- Clients fill these in when submitting a daily check-in.
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS weight_kg    NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS sleep_hours  NUMERIC(4, 2),
  ADD COLUMN IF NOT EXISTS steps        INTEGER,
  ADD COLUMN IF NOT EXISTS energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 10);

-- Index for fast time-series queries on a client's metrics
CREATE INDEX IF NOT EXISTS idx_checkins_metrics ON public.checkins(client_id, created_at DESC)
  WHERE weight_kg IS NOT NULL OR sleep_hours IS NOT NULL OR steps IS NOT NULL OR energy_level IS NOT NULL;
