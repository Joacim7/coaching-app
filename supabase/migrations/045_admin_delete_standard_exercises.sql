-- Allow org admins (app owner) to delete standard (shared, coach_id IS NULL) exercises.
-- Regular coaches can still only delete their own exercises (existing policy).

CREATE OR REPLACE FUNCTION public.is_any_org_admin()
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

CREATE POLICY "org_admins_delete_standard_exercises"
  ON public.exercises FOR DELETE
  USING (is_standard = true AND public.is_any_org_admin());
