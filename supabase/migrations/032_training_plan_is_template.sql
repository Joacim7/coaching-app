-- Explicit template flag on training plans (client_id = null was the implicit marker)
ALTER TABLE public.training_plans
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false;
