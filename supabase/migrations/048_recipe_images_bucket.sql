-- Storage bucket for AI-generated recipe photos (DALL-E / gpt-image-1-mini).
-- Images are uploaded here instead of being embedded as base64 data URIs
-- directly in recipes.image_url — storing raw base64 in that column made
-- rows multi-megabyte, which could cause the recipes list query
-- (`select('*')` across the whole table) to fail or time out.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('recipe-images', 'recipe-images', true, 10485760)  -- 10 MB
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 10485760;

DROP POLICY IF EXISTS "coaches_upload_recipe_images" ON storage.objects;
DROP POLICY IF EXISTS "coaches_delete_recipe_images" ON storage.objects;

-- Coaches can only write inside their own UUID folder
CREATE POLICY "coaches_upload_recipe_images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'recipe-images'
  AND auth.uid() IS NOT NULL
  AND split_part(name, '/', 1) = (auth.uid())::text
);

CREATE POLICY "coaches_delete_recipe_images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'recipe-images'
  AND split_part(name, '/', 1) = (auth.uid())::text
);

-- Public bucket = anyone with the URL can read; no SELECT policy needed.
