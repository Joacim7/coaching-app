-- ── org_shared_resources ────────────────────────────────────────────────────────
-- Admins can share any of their resources with all coaches in the org.
-- resource_type is one of: 'recipe', 'exercise', 'training_plan', 'checkin_template'

CREATE TABLE public.org_shared_resources (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  resource_type TEXT        NOT NULL CHECK (resource_type IN ('recipe', 'exercise', 'training_plan', 'checkin_template')),
  resource_id   UUID        NOT NULL,
  shared_by     UUID        NOT NULL REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, resource_type, resource_id)
);

ALTER TABLE public.org_shared_resources ENABLE ROW LEVEL SECURITY;

-- Any org member can see what resources are shared in their org
CREATE POLICY "org_members_view_shared_resources"
  ON public.org_shared_resources FOR SELECT
  USING (public.is_org_member(org_id));

-- Only org admins can add or remove shared resources
CREATE POLICY "org_admin_manage_shared_resources"
  ON public.org_shared_resources FOR ALL
  USING (public.is_org_admin(org_id))
  WITH CHECK (public.is_org_admin(org_id));

CREATE INDEX idx_org_shared_org_type ON public.org_shared_resources(org_id, resource_type);

-- ── Additive SELECT policies on resource tables ────────────────────────────────
-- These are additive — existing policies are NOT dropped.
-- They allow org members to read resources that have been shared within their org.

CREATE POLICY "read_org_shared_recipes"
  ON public.recipes FOR SELECT
  USING (
    id IN (
      SELECT osr.resource_id
      FROM   public.org_shared_resources osr
      JOIN   public.org_members          om  ON om.org_id = osr.org_id
      WHERE  osr.resource_type = 'recipe'
      AND    om.user_id = auth.uid()
    )
  );

CREATE POLICY "read_org_shared_training_plans"
  ON public.training_plans FOR SELECT
  USING (
    id IN (
      SELECT osr.resource_id
      FROM   public.org_shared_resources osr
      JOIN   public.org_members          om  ON om.org_id = osr.org_id
      WHERE  osr.resource_type = 'training_plan'
      AND    om.user_id = auth.uid()
    )
  );

CREATE POLICY "read_org_shared_checkin_templates"
  ON public.checkin_templates FOR SELECT
  USING (
    id IN (
      SELECT osr.resource_id
      FROM   public.org_shared_resources osr
      JOIN   public.org_members          om  ON om.org_id = osr.org_id
      WHERE  osr.resource_type = 'checkin_template'
      AND    om.user_id = auth.uid()
    )
  );

CREATE POLICY "read_org_shared_exercises"
  ON public.exercises FOR SELECT
  USING (
    id IN (
      SELECT osr.resource_id
      FROM   public.org_shared_resources osr
      JOIN   public.org_members          om  ON om.org_id = osr.org_id
      WHERE  osr.resource_type = 'exercise'
      AND    om.user_id = auth.uid()
    )
  );
