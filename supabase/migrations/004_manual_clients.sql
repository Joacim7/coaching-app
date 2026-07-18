-- ============================================================
-- Allow coaches to add clients manually (without auth account)
-- ============================================================

-- 1. Remove FK from profiles.id → auth.users so we can create
--    "pending" client profiles without a Supabase auth account.
--    The on-signup trigger still creates profiles for real users.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 2. Add email column for manual clients (used to match them
--    later when they actually sign up via the app).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

-- 3. Expand coach_clients.status to cover all client stages.
ALTER TABLE public.coach_clients
  DROP CONSTRAINT IF EXISTS coach_clients_status_check;
ALTER TABLE public.coach_clients
  ADD CONSTRAINT coach_clients_status_check
  CHECK (status IN ('active', 'inactive', 'new', 'onboarding', 'course', 'followup'));

-- Default status for new manual clients should be 'new'
ALTER TABLE public.coach_clients
  ALTER COLUMN status SET DEFAULT 'new';

-- 4. Let coaches INSERT profiles for their clients.
DROP POLICY IF EXISTS "Coaches can create client profiles" ON public.profiles;
CREATE POLICY "Coaches can create client profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.get_my_role() = 'coach'
  );

-- 5. Fix is_my_client() — remove the status = 'active' filter so coaches
--    can see clients with any status (new, onboarding, etc.).
CREATE OR REPLACE FUNCTION public.is_my_client(p_client_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coach_clients
    WHERE coach_id = auth.uid()
      AND client_id = p_client_id
  );
$$;

-- 6. Also fix checkin_templates SELECT for clients — same issue with old
--    is_my_client filtering. Drop and recreate the relevant policy.
DROP POLICY IF EXISTS "Clients can view templates from their coaches" ON public.checkin_templates;
CREATE POLICY "Clients can view templates from their coaches"
  ON public.checkin_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.coach_clients
      WHERE coach_id = checkin_templates.coach_id
        AND client_id = auth.uid()
    )
  );
