-- ── Share org-level documents & check-in templates with new clients ──────────
--
-- 018_document_auto_share_triggers.sql already auto-shares the inviting
-- coach's *personal* coach_documents with a newly invited client. It never
-- touched org-level resources (org_documents, or checkin_templates shared via
-- org_shared_resources) — so a client only ever saw documents/templates their
-- specific coach happened to own personally, not anything shared org-wide by
-- other coaches in the same organization.

-- ── org_documents → org_document_shares (snapshot at invite time, mirrors
--    the coach_documents trigger so behavior stays consistent) ───────────────

CREATE OR REPLACE FUNCTION public.auto_share_org_docs_with_new_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT org_id INTO v_org_id FROM public.org_members WHERE user_id = NEW.coach_id LIMIT 1;

  IF v_org_id IS NOT NULL THEN
    INSERT INTO public.org_document_shares (org_document_id, coach_id, client_id)
    SELECT od.id, NEW.coach_id, NEW.client_id
    FROM public.org_documents od
    WHERE od.org_id = v_org_id
    ON CONFLICT (org_document_id, coach_id, client_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_share_org_docs_new_client ON public.coach_clients;
CREATE TRIGGER trg_auto_share_org_docs_new_client
AFTER INSERT ON public.coach_clients
FOR EACH ROW
EXECUTE FUNCTION public.auto_share_org_docs_with_new_client();

-- ── checkin_templates: dynamic read policy instead of a snapshot table ───────
-- Unlike documents, there's no per-client curation UI for templates — a
-- template shared org-wide should just be visible to every client whose
-- coach belongs to that org. A live RLS policy (rather than a table
-- populated at invite time) also means this fixes visibility for clients
-- who were invited before this migration, with no backfill needed.

DROP POLICY IF EXISTS "clients_view_org_shared_templates" ON public.checkin_templates;

CREATE POLICY "clients_view_org_shared_templates"
  ON public.checkin_templates FOR SELECT
  USING (
    id IN (
      SELECT osr.resource_id
      FROM   public.org_shared_resources osr
      JOIN   public.org_members          om ON om.org_id = osr.org_id
      JOIN   public.coach_clients         cc ON cc.coach_id = om.user_id
      WHERE  osr.resource_type = 'checkin_template'
        AND  cc.client_id = auth.uid()
        AND  cc.status = 'active'
    )
  );
