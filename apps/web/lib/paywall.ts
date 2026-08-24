// The org admin account and any coach who belongs to an organization with an
// active paid plan are exempt from the standalone-coach paywall —
// organizations manage their own client/subscription arrangements outside
// individual coach subscriptions. A coach in a still-unpaid (pending) org
// gets no exemption, otherwise creating an org would itself be a free way to
// bypass the individual paywall forever.
export const ORG_ADMIN_ID = '001bde00-57e8-4918-8c53-f596e0efbddb'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function isExemptFromPaywall(supabase: any, coachId: string): Promise<boolean> {
  if (coachId === ORG_ADMIN_ID) return true
  const { data } = await supabase
    .from('org_members')
    .select('organizations(subscription_plan)')
    .eq('user_id', coachId)
    .limit(1)
  const org = data?.[0]?.organizations as { subscription_plan: string | null } | null
  return !!org?.subscription_plan
}

// True if this coach can use the dashboard: exempt, or subscribed to a paid plan.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function coachHasActiveAccess(supabase: any, coachId: string): Promise<boolean> {
  if (await isExemptFromPaywall(supabase, coachId)) return true
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_plan')
    .eq('id', coachId)
    .single()
  return (profile?.subscription_plan ?? 'free') !== 'free'
}
