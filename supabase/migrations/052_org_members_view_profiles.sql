-- ── Org members can see each other's names ────────────────────────────────────
--
-- The "Coaches" tab (and anywhere else that lists org_members joined with
-- profiles) was showing every fellow member as "Ukjent" — profiles RLS only
-- ever allowed reading your own profile, or a coach reading their own
-- clients' profiles. There was no rule letting two coaches in the same
-- organization see each other's full_name/email, so the profiles!user_id(...)
-- join in /api/organization/coaches silently came back null for anyone who
-- wasn't the requesting user themselves.

CREATE OR REPLACE FUNCTION public.shares_org_with(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_members me
    JOIN public.org_members them ON them.org_id = me.org_id
    WHERE me.user_id = auth.uid() AND them.user_id = p_user_id
  );
$$;

DROP POLICY IF EXISTS "org_members_view_fellow_profiles" ON public.profiles;

CREATE POLICY "org_members_view_fellow_profiles"
  ON public.profiles FOR SELECT
  USING (public.shares_org_with(id));
