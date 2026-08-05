-- ── Let any coach share/unshare their own meal plan templates ─────────────────
--
-- The Delte ressurser UI already assumed self-service sharing (its "remove"
-- button checks `isAdmin || item.sharedBy === userId`), but the only INSERT/
-- DELETE policy on org_shared_resources was "org_admin_manage_shared_resources"
-- (admin-only). A non-admin coach clicking "Del eksisterende" on their own
-- meal plan would hit an RLS error. Add narrow, resource-owner-checked
-- policies for meal_plan specifically (the case that prompted this).

CREATE POLICY "coach_share_own_meal_plans"
  ON public.org_shared_resources FOR INSERT
  WITH CHECK (
    resource_type = 'meal_plan'
    AND shared_by = auth.uid()
    AND public.is_org_member(org_id)
    AND EXISTS (
      SELECT 1 FROM public.meal_plans
      WHERE id = resource_id AND coach_id = auth.uid()
    )
  );

CREATE POLICY "coach_unshare_own_meal_plans"
  ON public.org_shared_resources FOR DELETE
  USING (resource_type = 'meal_plan' AND shared_by = auth.uid());
