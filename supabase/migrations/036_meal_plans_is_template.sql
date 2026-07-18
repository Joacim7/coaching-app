-- Explicit template flag for meal plans (mirrors training_plans approach)
ALTER TABLE public.meal_plans
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false;
