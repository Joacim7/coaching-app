-- Stores each client's Polar AccessLink OAuth connection. Only ever
-- accessed via the service-role key from apps/web API routes (the mobile
-- app never talks to this table directly, and never sees the access
-- token) — RLS is enabled with no policies so it fails closed if the
-- anon/authenticated key is ever used against it directly.

CREATE TABLE IF NOT EXISTS public.polar_connections (
  user_id        UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  polar_user_id  TEXT NOT NULL,
  member_id      TEXT NOT NULL,
  access_token   TEXT NOT NULL,
  token_type     TEXT NOT NULL DEFAULT 'bearer',
  connected_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.polar_connections ENABLE ROW LEVEL SECURITY;
