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

// 'free' is not a purchasable plan and is never shown on /pricing — every
// coach must subscribe before adding a single client. It's kept as a plan
// definition only because profiles.subscription_plan defaults to 'free' (the
// pre-subscription state) and its DB CHECK constraint still allows the
// value; clientLimit: 0 is what actually enforces "must pay for client #1".
export const PLANS: PlanInfo[] = [
  {
    slug: 'free',
    displayName: 'Free',
    priceKr: 0,
    clientLimit: 0,
    features: [],
  },
  {
    slug: 'starter',
    displayName: 'Starter',
    priceKr: 599,
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

// Plans actually shown on /pricing — excludes the non-purchasable 'free' state.
export const DISPLAY_PLANS: PlanInfo[] = PLANS.filter(p => p.slug !== 'free')

export function planBySlug(slug: string | null | undefined): PlanInfo {
  return PLANS.find(p => p.slug === slug) ?? PLANS[0]
}

export function planClientLimit(slug: string | null | undefined): number | null {
  return planBySlug(slug).clientLimit
}
