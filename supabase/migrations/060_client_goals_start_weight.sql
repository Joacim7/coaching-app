ALTER TABLE public.client_goals
  ADD COLUMN IF NOT EXISTS start_weight_kg DECIMAL(5,1);
