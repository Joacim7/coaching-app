-- Tracks every time the cron dispatched a check-in to a client.
-- The UNIQUE constraint is the deduplication key: one send per template+client+day.

CREATE TABLE IF NOT EXISTS public.scheduled_checkins (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id    UUID        NOT NULL REFERENCES public.checkin_templates(id) ON DELETE CASCADE,
  client_id      UUID        NOT NULL REFERENCES public.profiles(id)          ON DELETE CASCADE,
  scheduled_date DATE        NOT NULL DEFAULT CURRENT_DATE,
  email_sent     BOOLEAN     NOT NULL DEFAULT FALSE,
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (template_id, client_id, scheduled_date)
);

ALTER TABLE public.scheduled_checkins ENABLE ROW LEVEL SECURITY;

-- Coaches can see scheduled check-ins for their own templates
CREATE POLICY "coaches_view_scheduled_checkins"
  ON public.scheduled_checkins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.checkin_templates ct
      WHERE ct.id = template_id
        AND ct.coach_id = auth.uid()
    )
  );

-- Clients can see their own scheduled check-ins
CREATE POLICY "clients_view_own_scheduled_checkins"
  ON public.scheduled_checkins FOR SELECT
  USING (client_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_scheduled_checkins_template_date
  ON public.scheduled_checkins (template_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_checkins_client_date
  ON public.scheduled_checkins (client_id, scheduled_date DESC);
