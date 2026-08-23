// Shared plan metadata — safe to import from client components (no secrets).
// The stored value in profiles.subscription_plan and the Stripe price mapping
// both key off `slug`; `displayName` is only the marketing label shown on
// /pricing (e.g. the 'pro' slug is shown to coaches as "Growth").

export type PlanSlug = 'free' | 'starter' | 'pro' | 'unlimited'

export interface PlanInfo {
  slug: PlanSlug
  displayName: string
  priceKr: number
  clientLimit: number | null // null = no limit
  features: string[]
}

export const PLANS: PlanInfo[] = [
  {
    slug: 'free',
    displayName: 'Free',
    priceKr: 0,
    clientLimit: 3,
    features: ['Inntil 3 klienter', 'Alle kjernefunksjoner'],
  },
  {
    slug: 'starter',
    displayName: 'Starter',
    priceKr: 499,
    clientLimit: 10,
    features: ['Inntil 10 klienter', 'Alle kjernefunksjoner'],
  },
  {
    slug: 'pro',
    displayName: 'Growth',
    priceKr: 999,
    clientLimit: 20,
    features: ['Inntil 20 klienter', 'Alle kjernefunksjoner'],
  },
  {
    slug: 'unlimited',
    displayName: 'Pro',
    priceKr: 1499,
    clientLimit: null,
    features: ['Ubegrenset antall klienter', 'Alle kjernefunksjoner'],
  },
]

export function planBySlug(slug: string | null | undefined): PlanInfo {
  return PLANS.find(p => p.slug === slug) ?? PLANS[0]
}

export function planClientLimit(slug: string | null | undefined): number | null {
  return planBySlug(slug).clientLimit
}
