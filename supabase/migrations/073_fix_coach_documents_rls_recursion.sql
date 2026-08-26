-- ── Fix "infinite recursion detected in policy for relation coach_documents" ──
--
-- coach_documents' "clients_view_shared_coach_docs" policy (028) subqueries
-- coach_document_shares to check for a share row. coach_document_shares'
-- own "coaches_manage_shares" policy (017) subqueries coach_documents right
-- back to check ownership. Since RLS applies to each subquery too, this is a
-- genuine circular dependency: evaluating either table's policy requires
-- re-evaluating the other's, which requires the first again, and so on.
-- Postgres detects this and errors instead of looping forever — hit by
-- coaches simply saving a new document (an insert with a returned row needs
-- SELECT-policy evaluation on coach_documents).
--
-- Wrapping each cross-table check in a SECURITY DEFINER function breaks the
-- cycle: such functions aren't inlined into the calling query the way a
-- plain correlated subquery is, and since they run as their owner (who owns
-- these tables and — without FORCE ROW LEVEL SECURITY — isn't subject to
-- RLS), their internal queries never re-enter policy evaluation at all.
-- Same pattern already used for is_my_client() (002/004).

CREATE OR REPLACE FUNCTION public.owns_coach_document(p_document_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coach_documents
    WHERE id = p_document_id
      AND coach_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.document_shared_with_me(p_document_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coach_document_shares
    WHERE document_id = p_document_id
      AND client_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "clients_view_shared_coach_docs" ON public.coach_documents;
CREATE POLICY "clients_view_shared_coach_docs"
  ON public.coach_documents FOR SELECT
  USING (public.document_shared_with_me(id));

DROP POLICY IF EXISTS "coaches_manage_shares" ON public.coach_document_shares;
CREATE POLICY "coaches_manage_shares"
  ON public.coach_document_shares FOR ALL
  USING  (public.owns_coach_document(document_id))
  WITH CHECK (public.owns_coach_document(document_id));
