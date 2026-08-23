import Stripe from 'stripe'
import type { PlanSlug } from './plans'

// Server-only — never import this from a client component.
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
  return new Stripe(key, { apiVersion: '2026-07-29.dahlia' })
}

// Paid plans only — 'free' has no Stripe price.
export const STRIPE_PRICE_ENV: Record<Exclude<PlanSlug, 'free'>, string | undefined> = {
  starter:   process.env.STRIPE_PRICE_STARTER,
  pro:       process.env.STRIPE_PRICE_PRO,
  unlimited: process.env.STRIPE_PRICE_UNLIMITED,
}

export function planSlugForPriceId(priceId: string): PlanSlug | null {
  for (const [slug, id] of Object.entries(STRIPE_PRICE_ENV)) {
    if (id === priceId) return slug as PlanSlug
  }
  return null
}
