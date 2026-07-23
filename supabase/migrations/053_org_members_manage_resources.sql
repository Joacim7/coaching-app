-- ── Let any org member share resources & upload documents, not just admins ────
--
-- Previously only org admins could add shared resources (training plans,
-- exercises, recipes) or upload org documents. Any coach in the org should be
-- able to contribute these; admin stays required for the invite/member
-- management side (pending invitations are also admin-only to view — see the
-- API-level change in /api/organization/coaches).
--
-- Removal is scoped to "admin, or whoever added it" rather than opened to
-- everyone, so one coach can't casually delete another's contribution.

-- ── org_shared_resources ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "org_admin_manage_shared_resources" ON public.org_shared_resources;

CREATE POLICY "org_members_share_resources"
  ON public.org_shared_resources FOR INSERT
  WITH CHECK (public.is_org_member(org_id));

CREATE POLICY "org_admin_or_sharer_remove_shared_resources"
  ON public.org_shared_resources FOR DELETE
  USING (public.is_org_admin(org_id) OR shared_by = auth.uid());

-- ── org_documents ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "org_admin_manage_docs" ON public.org_documents;

CREATE POLICY "org_members_insert_docs"
  ON public.org_documents FOR INSERT
  WITH CHECK (public.is_org_member(org_id));

CREATE POLICY "org_admin_or_uploader_update_docs"
  ON public.org_documents FOR UPDATE
  USING (public.is_org_admin(org_id) OR uploaded_by = auth.uid());

CREATE POLICY "org_admin_or_uploader_delete_docs"
  ON public.org_documents FOR DELETE
  USING (public.is_org_admin(org_id) OR uploaded_by = auth.uid());

-- ── storage: org-documents bucket ───────────────────────────────────────────────

DROP POLICY IF EXISTS "org_admins_upload_docs" ON storage.objects;

CREATE POLICY "org_members_upload_docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'org-documents'
  AND EXISTS (
    SELECT 1 FROM public.org_members
    WHERE user_id = auth.uid()
      AND org_id::text = split_part(name, '/', 1)
  )
);

DROP POLICY IF EXISTS "org_admins_delete_docs" ON storage.objects;

CREATE POLICY "org_admin_or_uploader_delete_docs_storage"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'org-documents'
  AND (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE user_id = auth.uid() AND role = 'admin'
        AND org_id::text = split_part(name, '/', 1)
    )
    OR EXISTS (
      SELECT 1 FROM public.org_documents
      WHERE file_path = name AND uploaded_by = auth.uid()
    )
  )
);
