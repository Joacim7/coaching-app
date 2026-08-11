-- ── Fix: clients can't see any check-in templates until status = 'active' ────
--
-- Both the original per-coach policy (002_rls.sql) and the org-shared policy
-- (056_fix_client_org_template_visibility.sql) gate template visibility on
-- coach_clients.status = 'active'. But status only flips to 'active'
-- automatically once a client has both an active training plan AND an active
-- meal plan (051_auto_activate_new_client.sql) — which normally happens
-- *after* onboarding. A brand new client (status = 'new' or 'onboarding')
-- therefore saw zero check-in templates: no onboarding form, no daily/weekly
-- check-ins, own-coach or org-shared alike. Confirmed live: a client added
-- minutes earlier, whose coach's org had 3 shared templates, got `[]` back
-- reading checkin_templates as themselves.
--
-- The rest of the app already treats "status != 'inactive'" as the
-- definition of an ongoing coaching relationship (see e.g. the documents
-- page's client list, the onboarding-reminder cron, resend-onboarding) —
-- only an explicitly deactivated relationship should lose access. Align
-- both template-visibility checks with that same convention.

DROP POLICY IF EXISTS "Clients can view templates from their coaches" ON public.checkin_templates;

CREATE POLICY "Clients can view templates from their coaches"
  ON public.checkin_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.coach_clients
      WHERE coach_id = checkin_templates.coach_id
        AND client_id = auth.uid()
        AND status != 'inactive'
    )
  );

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
      AND  cc.status != 'inactive'
  );
$$;
