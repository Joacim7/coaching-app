-- The progress-photos bucket is private, so `getPublicUrl` never worked — clients
-- and coaches must use signed URLs instead. This also tightens the coach SELECT
-- policy, which previously let ANY authenticated user read ANY client's photos.

DROP POLICY IF EXISTS "coaches_view_client_progress_photos_storage" ON storage.objects;

CREATE POLICY "coaches_view_client_progress_photos_storage"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'progress-photos'
    AND split_part(name, '/', 1)::uuid IN (
      SELECT client_id FROM public.coach_clients WHERE coach_id = auth.uid()
    )
  );
