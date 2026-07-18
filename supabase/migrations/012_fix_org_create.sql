-- The INSERT policy on organizations can fail when auth.uid() isn't resolved
-- in the RLS context during server-side requests. A SECURITY DEFINER function
-- bypasses RLS and lets us control the logic atomically.

CREATE OR REPLACE FUNCTION public.create_organization(p_name TEXT)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org public.organizations;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF EXISTS (SELECT 1 FROM public.org_members WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Already in an organization';
  END IF;

  INSERT INTO public.organizations (name, created_by)
  VALUES (p_name, auth.uid())
  RETURNING * INTO v_org;

  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (v_org.id, auth.uid(), 'admin');

  RETURN row_to_json(v_org);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_organization TO authenticated;
