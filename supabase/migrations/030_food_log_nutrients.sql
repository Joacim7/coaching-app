ALTER TABLE public.food_log_entries
  ADD COLUMN IF NOT EXISTS food_id    TEXT,
  ADD COLUMN IF NOT EXISTS grams      NUMERIC(8,1),
  ADD COLUMN IF NOT EXISTS protein_g  NUMERIC(7,1),
  ADD COLUMN IF NOT EXISTS carbs_g    NUMERIC(7,1),
  ADD COLUMN IF NOT EXISTS fat_g      NUMERIC(7,1),
  ADD COLUMN IF NOT EXISTS meal_type  TEXT CHECK (meal_type IN ('frokost','lunsj','middag','kvelds','snacks'));
