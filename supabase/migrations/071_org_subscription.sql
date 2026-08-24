-- Organizations must have a paid plan (Team/Business/Enterprise) before being
-- usable — a newly created org starts pending (subscription_plan IS NULL)
-- until its admin completes checkout on /organization. See lib/orgPlans.ts
-- and api/stripe/org-checkout, api/stripe/org-confirm, api/stripe/webhook.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT
    CHECK (subscription_plan IS NULL OR subscription_plan IN ('team', 'business', 'enterprise')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Grandfather in orgs that already exist so this doesn't retroactively lock
-- out coaches who were already relying on org-member paywall exemption.
-- "Nova Performance" already has max_coaches = 10, matching 'business'.
UPDATE public.organizations SET subscription_plan = 'business' WHERE subscription_plan IS NULL;
