-- ── Subscription plan, used for standalone-coach client-limit enforcement ────
--
-- invite-client enforces a client cap for standalone coaches (not org members,
-- not the org admin account) based on this column: free=3, starter=10, pro=20,
-- unlimited=no cap. Defaults every existing and new coach to 'free'.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_plan IN ('free', 'starter', 'pro', 'unlimited'));
