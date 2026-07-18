-- ── Auto-share triggers for coach documents ───────────────────────────────────
--
-- Rule 1: When a coach uploads a new document, automatically share it with
--         every client currently linked to that coach.
--
-- Rule 2: When a new client is linked to a coach, automatically share every
--         existing document that coach has already uploaded.
--
-- Both use ON CONFLICT DO NOTHING so re-running is always safe.

-- ── Trigger function: new document → share with all existing clients ───────────

CREATE OR REPLACE FUNCTION public.auto_share_document_with_clients()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.coach_document_shares (document_id, client_id)
  SELECT NEW.id, cc.client_id
  FROM   public.coach_clients cc
  WHERE  cc.coach_id = NEW.coach_id
  ON CONFLICT (document_id, client_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_share_document
AFTER INSERT ON public.coach_documents
FOR EACH ROW
EXECUTE FUNCTION public.auto_share_document_with_clients();

-- ── Trigger function: new client → share all existing coach documents ──────────

CREATE OR REPLACE FUNCTION public.auto_share_docs_with_new_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.coach_document_shares (document_id, client_id)
  SELECT cd.id, NEW.client_id
  FROM   public.coach_documents cd
  WHERE  cd.coach_id = NEW.coach_id
  ON CONFLICT (document_id, client_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_share_docs_new_client
AFTER INSERT ON public.coach_clients
FOR EACH ROW
EXECUTE FUNCTION public.auto_share_docs_with_new_client();
