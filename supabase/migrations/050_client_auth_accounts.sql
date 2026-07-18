-- Support creating a real Supabase Auth account for a client that was
-- originally added manually (see 004_manual_clients.sql), matched by
-- reusing the existing profiles.id as the new auth.users.id.
--
-- Without this fix, admin.createUser({ id: <existing profile id>, ... })
-- would fail: the on_auth_user_created trigger unconditionally inserts a
-- new profiles row for every new auth user, which collides with the
-- primary key of the pre-existing manual profile and rolls back the
-- entire auth.users insert.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Tracks whether this profile has a real Supabase Auth account (email +
-- password login), as opposed to a manually-added "pending" client.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_account BOOLEAN NOT NULL DEFAULT false;

-- Backfill: any profile that already corresponds to a real auth user
-- (i.e. was created via normal signup, not the manual-client path) should
-- be marked as already having an account.
UPDATE public.profiles p
SET has_account = true
WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id);
