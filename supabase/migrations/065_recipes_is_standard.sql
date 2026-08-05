-- ── Standard recipe library, visible to every coach on signup ─────────────────
--
-- Mirrors the exercises.is_standard pattern (006_exercises.sql): a coach
-- should see the seeded recipe library the moment they register, not just
-- once an admin explicitly shares it or they join the seeding coach's org.
-- Previously recipes were only visible within an org (015/055), so a coach
-- in a different (or no) org saw none of these 241 recipes at all.

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS is_standard BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_recipes_std ON public.recipes(is_standard);

-- Backfill: the 241 seeded recipes (not coach-authored, not AI-generated).
UPDATE public.recipes
SET is_standard = true
WHERE coach_id = '001bde00-57e8-4918-8c53-f596e0efbddb'
  AND is_ai_generated = false;

-- Standard recipes are readable by every authenticated coach, regardless of
-- org membership — additive to the existing owner/org-shared policies.
CREATE POLICY "Read standard recipes"
  ON public.recipes FOR SELECT
  USING (is_standard = true);
