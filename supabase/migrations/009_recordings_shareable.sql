-- Create the storage bucket as public so files get permanent shareable URLs
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('coach-recordings', 'coach-recordings', true, 524288000)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 524288000;

-- Storage write policies (coaches can only write inside their own UUID folder)
DROP POLICY IF EXISTS "coaches_upload_recordings" ON storage.objects;
DROP POLICY IF EXISTS "coaches_delete_recordings" ON storage.objects;

CREATE POLICY "coaches_upload_recordings"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'coach-recordings'
  AND auth.uid() IS NOT NULL
  AND split_part(name, '/', 1) = (auth.uid())::text
);

CREATE POLICY "coaches_delete_recordings"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'coach-recordings'
  AND split_part(name, '/', 1) = (auth.uid())::text
);

-- Public bucket = anyone with the URL can read; no SELECT policy needed.

-- Add share_url column to recordings (permanent public URL for client sharing)
ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS share_url TEXT;
