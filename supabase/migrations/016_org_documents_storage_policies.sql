-- ── Storage policies for org-documents bucket ────────────────────────────────
-- The bucket was created in 011 but had no storage.objects policies,
-- causing all uploads to be rejected by RLS.

-- Org admins may upload files whose path starts with their org_id
CREATE POLICY "org_admins_upload_docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'org-documents'
  AND EXISTS (
    SELECT 1 FROM public.org_members
    WHERE user_id  = auth.uid()
      AND role     = 'admin'
      AND org_id::text = split_part(name, '/', 1)
  )
);

-- Org admins may delete their org's files
CREATE POLICY "org_admins_delete_docs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'org-documents'
  AND EXISTS (
    SELECT 1 FROM public.org_members
    WHERE user_id  = auth.uid()
      AND role     = 'admin'
      AND org_id::text = split_part(name, '/', 1)
  )
);

-- Any org member may read files in their org's folder
-- (bucket is public so direct URL access already works, but this covers
--  authenticated downloads and signed URLs)
CREATE POLICY "org_members_read_docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'org-documents'
  AND EXISTS (
    SELECT 1 FROM public.org_members
    WHERE user_id  = auth.uid()
      AND org_id::text = split_part(name, '/', 1)
  )
);
