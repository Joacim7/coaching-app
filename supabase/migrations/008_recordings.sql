-- Recordings metadata table
CREATE TABLE IF NOT EXISTS public.recordings (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title            TEXT        NOT NULL DEFAULT 'Opptak',
  duration_seconds INTEGER,
  file_path        TEXT,
  file_size_bytes  BIGINT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coaches_manage_own_recordings" ON public.recordings
  FOR ALL USING (coach_id = auth.uid());

-- MANUAL STEP: Create a private Supabase Storage bucket named "coach-recordings"
-- in the Supabase dashboard (Storage > New bucket > Private).
-- Then add these storage policies:
--   Name: "coaches_upload_own_recordings"
--   Allowed operation: INSERT
--   Policy: bucket_id = 'coach-recordings' AND name LIKE (auth.uid()::text || '/%')
--
--   Name: "coaches_read_own_recordings"
--   Allowed operation: SELECT
--   Policy: bucket_id = 'coach-recordings' AND name LIKE (auth.uid()::text || '/%')
--
--   Name: "coaches_delete_own_recordings"
--   Allowed operation: DELETE
--   Policy: bucket_id = 'coach-recordings' AND name LIKE (auth.uid()::text || '/%')
