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
  popular?: boolean
}

// 'free' is not a purchasable plan and is never shown on /pricing — every
// coach must subscribe before adding a single client. It's kept as a plan
// definition only because profiles.subscription_plan defaults to 'free' (the
// pre-subscription state) and its DB CHECK constraint still allows the
// value; clientLimit: 0 is what actually enforces "must pay for client #1".
export const PLANS: PlanInfo[] = [
  { slug: 'free', displayName: 'Free', priceKr: 0, clientLimit: 0 },
  { slug: 'starter', displayName: 'Starter', priceKr: 599, clientLimit: 10 },
  { slug: 'pro', displayName: 'Growth', priceKr: 999, clientLimit: 20, popular: true },
  { slug: 'unlimited', displayName: 'Pro', priceKr: 1499, clientLimit: null },
]

// Plans actually shown on /pricing — excludes the non-purchasable 'free' state.
export const DISPLAY_PLANS: PlanInfo[] = PLANS.filter(p => p.slug !== 'free')

// Every paid plan includes the exact same feature set — the client limit
// (see planClientLimitLabel) is the only thing that differs between them.
export const PRICING_FEATURES: string[] = [
  '🏋️ Treningsplaner med øvelser og videoguider',
  '🥗 AI-genererte matplaner',
  '📊 Automatisk utregning av vekt, søvn og skritt',
  '📈 Progresjonssporing på vekt og reps',
  '🎥 Videoopptak direkte i appen',
  '✅ Ukentlige og daglige check-ins',
  '📱 Klientapp for iOS og Android',
  '💰 Økonomioversikt per klient',
]

// Kept short and similar in length across plans on purpose — "Ubegrenset
// antall klienter" wrapped to two lines at tablet widths while the other
// plans' labels stayed on one, which cascaded into misaligned feature lists
// across the cards.
export function planClientLimitLabel(plan: Pick<PlanInfo, 'clientLimit'>): string {
  return plan.clientLimit === null ? 'Ubegrenset klienter' : `Inntil ${plan.clientLimit} klienter`
}

export function planBySlug(slug: string | null | undefined): PlanInfo {
  return PLANS.find(p => p.slug === slug) ?? PLANS[0]
}

export function planClientLimit(slug: string | null | undefined): number | null {
  return planBySlug(slug).clientLimit
}
