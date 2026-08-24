import Stripe from 'stripe'
import type { PlanSlug } from './plans'
import type { OrgPlanSlug } from './orgPlans'

// True outside of a production deploy, or when explicitly forced via
// STRIPE_TEST_MODE=true — lets test-mode Stripe keys/prices be used locally
// without touching real money, without needing a separate .env file.
export function isStripeTestMode(): boolean {
  return process.env.STRIPE_TEST_MODE === 'true' || process.env.NODE_ENV !== 'production'
}

// Server-only — never import this from a client component.
export function getStripe(): Stripe {
  const key = isStripeTestMode() ? process.env.STRIPE_SECRET_KEY_TEST : process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error(
      isStripeTestMode() ? 'STRIPE_SECRET_KEY_TEST is not configured' : 'STRIPE_SECRET_KEY is not configured'
    )
  }
  return new Stripe(key, { apiVersion: '2026-07-29.dahlia' })
}

// Paid plans only — 'free' has no Stripe price. Test-mode price env vars are
// named after the /pricing display names (Growth/Pro), not the internal
// slugs — STRIPE_PRICE_GROWTH_TEST is the 'pro' slug's test price, and
// STRIPE_PRICE_PRO_TEST is the 'unlimited' slug's, matching the separate
// test-mode products already set up in the Stripe dashboard.
const LIVE_PRICE_ENV: Record<Exclude<PlanSlug, 'free'>, string | undefined> = {
  starter:   process.env.STRIPE_PRICE_STARTER,
  pro:       process.env.STRIPE_PRICE_PRO,
  unlimited: process.env.STRIPE_PRICE_UNLIMITED,
}

const TEST_PRICE_ENV: Record<Exclude<PlanSlug, 'free'>, string | undefined> = {
  starter:   process.env.STRIPE_PRICE_STARTER_TEST,
  pro:       process.env.STRIPE_PRICE_GROWTH_TEST,
  unlimited: process.env.STRIPE_PRICE_PRO_TEST,
}

export const STRIPE_PRICE_ENV: Record<Exclude<PlanSlug, 'free'>, string | undefined> =
  isStripeTestMode() ? TEST_PRICE_ENV : LIVE_PRICE_ENV

export function planSlugForPriceId(priceId: string): PlanSlug | null {
  for (const [slug, id] of Object.entries(STRIPE_PRICE_ENV)) {
    if (id === priceId) return slug as PlanSlug
  }
  return null
}

// Org plan price env vars use the naming already set up in the Stripe
// dashboard (opptil_N_coacher), not the internal slug names.
const LIVE_ORG_PRICE_ENV: Record<OrgPlanSlug, string | undefined> = {
  team:       process.env.STRIPE_PRICE_ORG_opptil_5_coacher,
  business:   process.env.STRIPE_PRICE_ORG_opptil_10_coacher,
  enterprise: process.env.STRIPE_PRICE_ORG_opptil_20_coacher,
}

const TEST_ORG_PRICE_ENV: Record<OrgPlanSlug, string | undefined> = {
  team:       process.env.STRIPE_PRICE_ORG_opptil_5_coacher_TEST,
  business:   process.env.STRIPE_PRICE_ORG_opptil_10_coacher_TEST,
  enterprise: process.env.STRIPE_PRICE_ORG_opptil_20_coacher_TEST,
}

export const STRIPE_ORG_PRICE_ENV: Record<OrgPlanSlug, string | undefined> =
  isStripeTestMode() ? TEST_ORG_PRICE_ENV : LIVE_ORG_PRICE_ENV

export function orgPlanSlugForPriceId(priceId: string): OrgPlanSlug | null {
  for (const [slug, id] of Object.entries(STRIPE_ORG_PRICE_ENV)) {
    if (id === priceId) return slug as OrgPlanSlug
  }
  return null
}
