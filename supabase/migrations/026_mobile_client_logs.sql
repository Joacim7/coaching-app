-- ── Workout logs (client side) ────────────────────────────────────────────────

CREATE TABLE public.workout_logs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  training_plan_id  UUID        REFERENCES public.training_plans(id) ON DELETE SET NULL,
  session_id        UUID        REFERENCES public.training_sessions(id) ON DELETE SET NULL,
  date              DATE        NOT NULL DEFAULT CURRENT_DATE,
  session_title     TEXT,
  sets_data         JSONB       NOT NULL DEFAULT '[]',
  -- [{exercise_name, set_number, weight_kg, reps, completed}]
  comment           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_own_workout_logs"
  ON public.workout_logs FOR ALL
  USING  (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "coaches_view_client_workout_logs"
  ON public.workout_logs FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM public.coach_clients WHERE coach_id = auth.uid()
    )
  );

-- ── Progress photos ────────────────────────────────────────────────────────────

CREATE TABLE public.progress_photos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  photo_url   TEXT        NOT NULL,
  date        DATE        NOT NULL DEFAULT CURRENT_DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_own_progress_photos"
  ON public.progress_photos FOR ALL
  USING  (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "coaches_view_client_progress_photos"
  ON public.progress_photos FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM public.coach_clients WHERE coach_id = auth.uid()
    )
  );

-- ── Food log ───────────────────────────────────────────────────────────────────

CREATE TABLE public.food_log_entries (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date        DATE        NOT NULL DEFAULT CURRENT_DATE,
  meal_name   TEXT        NOT NULL,
  description TEXT,
  calories    INTEGER,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.food_log_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_own_food_log"
  ON public.food_log_entries FOR ALL
  USING  (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "coaches_view_client_food_log"
  ON public.food_log_entries FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM public.coach_clients WHERE coach_id = auth.uid()
    )
  );

-- ── Storage bucket for progress photos ────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('progress-photos', 'progress-photos', false, 20971520)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "clients_upload_own_progress_photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'progress-photos'
    AND split_part(name, '/', 1) = (auth.uid())::text
  );

CREATE POLICY "clients_view_own_progress_photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'progress-photos'
    AND split_part(name, '/', 1) = (auth.uid())::text
  );

CREATE POLICY "coaches_view_client_progress_photos_storage"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'progress-photos');

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_workout_logs_client_date   ON public.workout_logs(client_id, date DESC);
CREATE INDEX idx_progress_photos_client     ON public.progress_photos(client_id, date DESC);
CREATE INDEX idx_food_log_client_date       ON public.food_log_entries(client_id, date DESC);
