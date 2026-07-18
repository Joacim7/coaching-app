-- Clients could upload and view their progress photos but never had a storage
-- DELETE policy, so removing a photo file would silently fail RLS.

CREATE POLICY "clients_delete_own_progress_photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'progress-photos'
    AND split_part(name, '/', 1) = (auth.uid())::text
  );
