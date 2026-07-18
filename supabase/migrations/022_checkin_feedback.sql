-- Coach feedback on a submitted check-in (comment + video link).
-- One feedback row per check-in (UNIQUE on checkin_id).

CREATE TABLE IF NOT EXISTS public.checkin_feedback (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id UUID        NOT NULL UNIQUE REFERENCES public.checkins(id) ON DELETE CASCADE,
  coach_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  comment    TEXT,
  video_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.checkin_feedback ENABLE ROW LEVEL SECURITY;

-- Coaches manage feedback they authored
CREATE POLICY "coaches_manage_checkin_feedback"
  ON public.checkin_feedback FOR ALL
  USING  (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Clients can read feedback on their own check-ins
CREATE POLICY "clients_read_own_checkin_feedback"
  ON public.checkin_feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.checkins c
      WHERE c.id = checkin_id
        AND c.client_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_checkin_feedback_checkin
  ON public.checkin_feedback (checkin_id);
