// Organization-level subscription plans — separate from individual coach
// plans (lib/plans.ts). An org exists in a "pending" state
// (organizations.subscription_plan IS NULL) from the moment it's created
// until an admin completes checkout for one of these; only then is it
// usable, and only then do its members become exempt from the individual
// coach paywall (see lib/paywall.ts).

export type OrgPlanSlug = 'team' | 'business' | 'enterprise'

export interface OrgPlanInfo {
  slug: OrgPlanSlug
  displayName: string
  priceKr: number
  maxCoaches: number
}

export const ORG_PLANS: OrgPlanInfo[] = [
  { slug: 'team', displayName: 'Team', priceKr: 4499, maxCoaches: 5 },
  { slug: 'business', displayName: 'Business', priceKr: 6499, maxCoaches: 10 },
  { slug: 'enterprise', displayName: 'Enterprise', priceKr: 9999, maxCoaches: 20 },
]

export function orgPlanBySlug(slug: string | null | undefined): OrgPlanInfo | undefined {
  return ORG_PLANS.find(p => p.slug === slug)
}
