-- Organizations must now be paid for before they exist at all — the coach
-- picks a name + plan, pays via Stripe, and only then does the org (and the
-- admin's org_members row) get created, by /api/stripe/org-confirm or the
-- webhook (see app/api/stripe/org-checkout, org-confirm, webhook).
--
-- create_organization_for_user takes the user id explicitly (rather than
-- relying on auth.uid()) because it's called from server contexts with no
-- end-user session — the webhook uses the service-role client, which has no
-- authenticated user at all. It's restricted to service_role only.
CREATE OR REPLACE FUNCTION public.create_organization_for_user(
  p_user_id     UUID,
  p_name        TEXT,
  p_plan        TEXT,
  p_max_coaches INTEGER
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org public.organizations;
BEGIN
  IF EXISTS (SELECT 1 FROM public.org_members WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'Already in an organization';
  END IF;

  INSERT INTO public.organizations (name, created_by, subscription_plan, max_coaches)
  VALUES (p_name, p_user_id, p_plan, p_max_coaches)
  RETURNING * INTO v_org;

  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (v_org.id, p_user_id, 'admin');

  RETURN row_to_json(v_org);
END;
$$;

REVOKE ALL ON FUNCTION public.create_organization_for_user FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_organization_for_user TO service_role;

-- The old free-creation path is no longer wired up to any API route — revoke
-- it so a coach can't bypass the payment wall by calling the RPC directly
-- (e.g. via supabase-js from devtools with their own session).
REVOKE EXECUTE ON FUNCTION public.create_organization(TEXT) FROM authenticated;
