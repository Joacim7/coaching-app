-- ── Coach personal documents ──────────────────────────────────────────────────

CREATE TABLE public.coach_documents (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  description     TEXT,
  file_path       TEXT        NOT NULL,
  file_size_bytes BIGINT,
  file_type       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.coach_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coaches_own_documents"
  ON public.coach_documents FOR ALL
  USING  (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- ── Document → client shares ──────────────────────────────────────────────────

CREATE TABLE public.coach_document_shares (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID        NOT NULL REFERENCES public.coach_documents(id) ON DELETE CASCADE,
  client_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shared_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(document_id, client_id)
);

ALTER TABLE public.coach_document_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coaches_manage_shares"
  ON public.coach_document_shares FOR ALL
  USING (
    document_id IN (
      SELECT id FROM public.coach_documents WHERE coach_id = auth.uid()
    )
  )
  WITH CHECK (
    document_id IN (
      SELECT id FROM public.coach_documents WHERE coach_id = auth.uid()
    )
  );

CREATE POLICY "clients_view_shares"
  ON public.coach_document_shares FOR SELECT
  USING (client_id = auth.uid());

-- ── Org document → client shares (coach-scoped) ───────────────────────────────

CREATE TABLE public.org_document_shares (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_document_id UUID        NOT NULL REFERENCES public.org_documents(id) ON DELETE CASCADE,
  coach_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shared_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_document_id, coach_id, client_id)
);

ALTER TABLE public.org_document_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coaches_manage_org_doc_shares"
  ON public.org_document_shares FOR ALL
  USING  (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "clients_view_org_doc_shares"
  ON public.org_document_shares FOR SELECT
  USING (client_id = auth.uid());

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_coach_documents_coach  ON public.coach_documents(coach_id);
CREATE INDEX idx_doc_shares_document    ON public.coach_document_shares(document_id);
CREATE INDEX idx_doc_shares_client      ON public.coach_document_shares(client_id);
CREATE INDEX idx_org_doc_shares_doc     ON public.org_document_shares(org_document_id);
CREATE INDEX idx_org_doc_shares_coach   ON public.org_document_shares(coach_id);
CREATE INDEX idx_org_doc_shares_client  ON public.org_document_shares(client_id);

-- ── Storage bucket ────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('coach-documents', 'coach-documents', true, 104857600)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 104857600;

-- Path structure: {coach_id}/{uuid}.{ext}

CREATE POLICY "coaches_upload_own_documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'coach-documents'
    AND split_part(name, '/', 1) = (auth.uid())::text
  );

CREATE POLICY "coaches_delete_own_documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'coach-documents'
    AND split_part(name, '/', 1) = (auth.uid())::text
  );

CREATE POLICY "authenticated_read_coach_documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'coach-documents');
