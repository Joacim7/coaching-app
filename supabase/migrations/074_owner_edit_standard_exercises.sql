-- Let the platform owner create exercises directly as standard (shared,
-- coach_id IS NULL) and edit existing standard exercises in place instead of
-- forcing a copy. Scoped to this one hardcoded account (same id as
-- ORG_ADMIN_ID in apps/web/lib/paywall.ts and ADMIN_COACH_ID in
-- app/admin/page.tsx), not the broader is_any_org_admin() check used for
-- deleting standard exercises (045_admin_delete_standard_exercises.sql) —
-- "standard" here is Nova Performance's own shared library, not something
-- every org admin should be able to redefine.

CREATE POLICY "owner_update_standard_exercises"
  ON public.exercises FOR UPDATE
  USING (is_standard = true AND auth.uid() = '001bde00-57e8-4918-8c53-f596e0efbddb')
  WITH CHECK (is_standard = true AND auth.uid() = '001bde00-57e8-4918-8c53-f596e0efbddb');

CREATE POLICY "owner_insert_standard_exercises"
  ON public.exercises FOR INSERT
  WITH CHECK (
    is_standard = true
    AND coach_id IS NULL
    AND auth.uid() = '001bde00-57e8-4918-8c53-f596e0efbddb'
  );
