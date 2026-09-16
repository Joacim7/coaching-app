-- ── Push registration diagnostics ────────────────────────────────────────────
-- expo_push_token being NULL doesn't say WHY — permission never granted,
-- permission denied, missing EAS project id, or the actual token fetch
-- failing (e.g. Android's Firebase/FCM setup not working on that install).
-- Previously that failure only ever reached a console.warn on the client's
-- own device, which nobody could see remotely. This column records the
-- outcome of the most recent registration attempt so it's queryable from
-- the coach dashboard / directly in Supabase without needing physical
-- access to the client's phone.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_registration_status TEXT;
