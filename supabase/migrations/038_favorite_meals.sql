CREATE TABLE public.favorite_meals (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  meal_type   TEXT        NOT NULL DEFAULT 'frokost',
  ingredients JSONB       NOT NULL DEFAULT '[]',
  calories    INTEGER     NOT NULL DEFAULT 0,
  protein_g   NUMERIC(6,1) NOT NULL DEFAULT 0,
  carbs_g     NUMERIC(6,1) NOT NULL DEFAULT 0,
  fat_g       NUMERIC(6,1) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.favorite_meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_manage_own_favorites"
  ON public.favorite_meals FOR ALL
  USING  (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

CREATE INDEX idx_favorite_meals_client ON public.favorite_meals(client_id);
