-- Storage bucket for coach-uploaded exercise demonstration videos.
-- Mirrors recipe-images (048) / exercise-images: public bucket so the
-- stored public URL is readable by anyone with no RLS SELECT policy
-- needed; coaches can only write inside their own UUID folder, so this
-- works for every coach in an org, not just admins.
--
-- file_size_limit is set generously (500 MB) since videos need to support
-- "any size and length" — note this is still bounded by whatever request
-- body size the Supabase project's plan enforces at the edge, which a
-- migration can't change; very large uploads may need a plan upgrade.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('exercise-videos', 'exercise-videos', true, 524288000)  -- 500 MB
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 524288000;

CREATE POLICY "coaches_upload_exercise_videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'exercise-videos'
  AND auth.uid() IS NOT NULL
  AND split_part(name, '/', 1) = (auth.uid())::text
);

CREATE POLICY "coaches_delete_exercise_videos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'exercise-videos'
  AND split_part(name, '/', 1) = (auth.uid())::text
);
