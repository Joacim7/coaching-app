-- Storage bucket for coach-uploaded exercise thumbnail images.
-- Mirrors the recipe-images bucket (048): public bucket so the stored
-- public URL is readable by anyone with no RLS SELECT policy needed;
-- coaches can only write inside their own UUID folder, so this works for
-- every coach in an org, not just admins.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('exercise-images', 'exercise-images', true, 10485760)  -- 10 MB
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 10485760;

CREATE POLICY "coaches_upload_exercise_images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'exercise-images'
  AND auth.uid() IS NOT NULL
  AND split_part(name, '/', 1) = (auth.uid())::text
);

CREATE POLICY "coaches_delete_exercise_images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'exercise-images'
  AND split_part(name, '/', 1) = (auth.uid())::text
);
