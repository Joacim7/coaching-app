-- ── Fix: clients_view_org_shared_templates never actually worked ─────────────
--
-- Migration 054 added a policy on checkin_templates so a client could see a
-- template shared org-wide, not just their own coach's. Its USING clause was
-- a raw subquery joining org_shared_resources → org_members → coach_clients.
--
-- That subquery runs under the QUERYING role's own RLS, same as any other
-- query — and clients have no SELECT policy on org_members at all (only
-- coaches, who are org_members themselves, can read it). So the join always
-- returned zero rows for an actual client, and the policy silently granted
-- nothing. Confirmed live: a real client session got `[]` reading a
-- template that was genuinely shared in their coach's org, while the coach
-- reading the same row worked fine.
--
-- Fix: move the check into a SECURITY DEFINER function (same pattern as
-- shares_org_with in 052), so it evaluates with the function owner's
-- privileges instead of the client's — bypassing the org_members/
-- coach_clients RLS wall for this specific, narrow check.

CREATE OR REPLACE FUNCTION public.is_org_shared_template_for_client(p_template_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.org_shared_resources osr
    JOIN   public.org_members          om ON om.org_id = osr.org_id
    JOIN   public.coach_clients         cc ON cc.coach_id = om.user_id
    WHERE  osr.resource_type = 'checkin_template'
      AND  osr.resource_id = p_template_id
      AND  cc.client_id = auth.uid()
      AND  cc.status = 'active'
  );
$$;

DROP POLICY IF EXISTS "clients_view_org_shared_templates" ON public.checkin_templates;

CREATE POLICY "clients_view_org_shared_templates"
  ON public.checkin_templates FOR SELECT
  USING (public.is_org_shared_template_for_client(id));
