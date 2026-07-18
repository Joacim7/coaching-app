-- Clients can read coach_documents that have been explicitly shared with them
CREATE POLICY "clients_view_shared_coach_docs"
  ON public.coach_documents FOR SELECT
  USING (
    id IN (
      SELECT document_id
      FROM   public.coach_document_shares
      WHERE  client_id = auth.uid()
    )
  );

-- Clients can read org_documents that have been explicitly shared with them
CREATE POLICY "clients_view_shared_org_docs"
  ON public.org_documents FOR SELECT
  USING (
    id IN (
      SELECT org_document_id
      FROM   public.org_document_shares
      WHERE  client_id = auth.uid()
    )
  );
