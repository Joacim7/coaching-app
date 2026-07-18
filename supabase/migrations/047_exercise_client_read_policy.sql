-- Ensure clients can read standard exercises (needed for the mobile app to
-- backfill exercise demonstration video URLs from the exercise library).
-- This duplicates the intent of the "Read standard exercises" policy from
-- 006_exercises.sql; adding it again here in case that policy is missing
-- on this project (e.g. migrations applied out of order, or a fresh
-- Supabase project that never picked up 006).

DROP POLICY IF EXISTS "clients_read_standard_exercises" ON public.exercises;

CREATE POLICY "clients_read_standard_exercises"
  ON public.exercises FOR SELECT
  USING (is_standard = true);
