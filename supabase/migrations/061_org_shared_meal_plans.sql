-- ── Allow meal plans as a shareable org resource ───────────────────────────────
-- Mirrors training_plan support added in 015: an admin can share a complete
-- meal plan (a template with client_id IS NULL, same "library" concept as
-- training_plans) so every coach in the org can see and assign it.

ALTER TABLE public.org_shared_resources
  DROP CONSTRAINT IF EXISTS org_shared_resources_resource_type_check;

ALTER TABLE public.org_shared_resources
  ADD CONSTRAINT org_shared_resources_resource_type_check
  CHECK (resource_type IN ('recipe', 'exercise', 'training_plan', 'checkin_template', 'meal_plan'));

-- Additive SELECT policy — existing meal_plans policies (coach owns / client
-- assigned) are untouched.
CREATE POLICY "read_org_shared_meal_plans"
  ON public.meal_plans FOR SELECT
  USING (
    id IN (
      SELECT osr.resource_id
      FROM   public.org_shared_resources osr
      JOIN   public.org_members          om  ON om.org_id = osr.org_id
      WHERE  osr.resource_type = 'meal_plan'
      AND    om.user_id = auth.uid()
    )
  );
