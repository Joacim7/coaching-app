-- Custom ingredients saved by coaches (per 100g values)
CREATE TABLE public.custom_ingredients (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id        UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            TEXT         NOT NULL,
  calories_per_100g NUMERIC(8,2) NOT NULL DEFAULT 0,
  protein_per_100g  NUMERIC(8,2) NOT NULL DEFAULT 0,
  carbs_per_100g    NUMERIC(8,2) NOT NULL DEFAULT 0,
  fat_per_100g      NUMERIC(8,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE public.custom_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coaches_own_custom_ingredients"
ON public.custom_ingredients
USING (coach_id = auth.uid())
WITH CHECK (coach_id = auth.uid());

CREATE INDEX idx_custom_ingredients_coach ON public.custom_ingredients(coach_id);

-- Recipes created by coaches
-- ingredients JSONB schema:
--   [{id, name, amount_g, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, source}]
CREATE TABLE public.recipes (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id              UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title                 TEXT         NOT NULL,
  description           TEXT,
  instructions          TEXT,
  image_url             TEXT,
  servings              INTEGER      NOT NULL DEFAULT 1,
  ingredients           JSONB        NOT NULL DEFAULT '[]',
  calories_per_serving  NUMERIC(8,2),
  protein_per_serving   NUMERIC(8,2),
  carbs_per_serving     NUMERIC(8,2),
  fat_per_serving       NUMERIC(8,2),
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coaches_own_recipes"
ON public.recipes
USING (coach_id = auth.uid())
WITH CHECK (coach_id = auth.uid());

CREATE INDEX idx_recipes_coach ON public.recipes(coach_id);
