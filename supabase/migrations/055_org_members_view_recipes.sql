-- ── Org members can read each other's recipes ─────────────────────────────────
--
-- recipes only had "coaches_own_recipes" (own rows) plus the org_shared_resources
-- opt-in policy from 015, which requires each recipe to be explicitly shared.
-- A new coach joining an org should immediately see every recipe already
-- created by their org-mates (most commonly the admin's recipe library),
-- without anyone having to individually share each one first.
--
-- Reuses the shares_org_with() helper added in 052 for the equivalent
-- profiles-visibility fix.

CREATE POLICY "org_members_view_org_coach_recipes"
  ON public.recipes FOR SELECT
  USING (public.shares_org_with(coach_id));
