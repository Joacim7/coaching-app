-- Clean up recipes.image_url values that were saved as raw base64 data URIs
-- (from the gpt-image-1-mini integration, before it was switched to uploading
-- to the recipe-images Storage bucket in 048). These bloat rows to
-- multi-megabyte size, which can make the recipes list query
-- (`select('*')` across the whole table) fail or time out — surfacing as an
-- empty recipes page even though rows exist. Null them out; the recipes UI
-- already falls back to a placeholder image when image_url is null.

UPDATE public.recipes
SET image_url = NULL
WHERE image_url LIKE 'data:%';
