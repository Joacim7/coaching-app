ALTER TABLE public.food_log_entries
  ADD COLUMN IF NOT EXISTS ingredients JSONB NOT NULL DEFAULT '[]';

ALTER TABLE public.food_log_entries
  ALTER COLUMN food_id DROP NOT NULL,
  ALTER COLUMN grams   DROP NOT NULL;
