-- Idempotent: adds check-in metric + menstruation columns if they don't exist yet.
-- Safe to run even if migrations 005 and 029 were already applied.
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS weight_kg    NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS sleep_hours  NUMERIC(4, 2),
  ADD COLUMN IF NOT EXISTS steps        INTEGER,
  ADD COLUMN IF NOT EXISTS energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS menstruation BOOLEAN;
