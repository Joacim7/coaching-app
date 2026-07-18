CREATE TABLE IF NOT EXISTS public.client_goals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coach_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_weight_kg DECIMAL(5,1),
  description      TEXT,
  start_date       DATE,
  target_date      DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach manages goals"
  ON public.client_goals FOR ALL
  USING (auth.uid() = coach_id);

CREATE POLICY "Client reads own goals"
  ON public.client_goals FOR SELECT
  USING (auth.uid() = client_id);
