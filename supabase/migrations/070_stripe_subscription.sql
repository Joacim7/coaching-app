-- ── Stripe subscription tracking on profiles ─────────────────────────────────
--
-- Lets the Stripe webhook map incoming subscription events (keyed by Stripe
-- customer id) back to the coach whose profile.subscription_plan to update,
-- and lets checkout reuse an existing Stripe customer instead of creating a
-- duplicate one on every checkout attempt.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
  ON public.profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
