-- ── Let a coach see their client's saved favorite meals ──────────────────────
--
-- favorite_meals only ever had "clients_manage_own_favorites" (client_id =
-- auth.uid()) — a coach had no way to read what their client saved from the
-- mobile app at all. Not using is_my_client() here: that helper requires
-- status = 'active', which (see 066) wrongly excludes new/onboarding
-- clients from features that should work for any non-inactive relationship.

CREATE POLICY "coaches_view_client_favorite_meals"
  ON public.favorite_meals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.coach_clients
      WHERE coach_id = auth.uid()
        AND client_id = favorite_meals.client_id
        AND status != 'inactive'
    )
  );
