-- Raise the recipe-images size cap from 10 MB to 50 MB — modern phone
-- camera photos (especially panoramas/high-res JPEGs and HEIC) routinely
-- exceed 10 MB, which was silently rejecting valid uploads for coaches.

UPDATE storage.buckets SET file_size_limit = 52428800 WHERE id = 'recipe-images';  -- 50 MB
