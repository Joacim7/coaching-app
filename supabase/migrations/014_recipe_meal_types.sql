ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS meal_type TEXT;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_recipes_meal_type ON public.recipes(coach_id, meal_type);
