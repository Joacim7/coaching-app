ALTER TABLE public.client_phases
  ADD COLUMN IF NOT EXISTS phase_type       TEXT,
  ADD COLUMN IF NOT EXISTS description      TEXT,
  ADD COLUMN IF NOT EXISTS training_plan_id UUID REFERENCES public.training_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS meal_plan_id     UUID REFERENCES public.meal_plans(id) ON DELETE SET NULL;
