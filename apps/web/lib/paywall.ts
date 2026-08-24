// The org admin account and any coach who belongs to an organization are
// exempt from the standalone-coach paywall — organizations manage their own
// client/subscription arrangements outside individual coach subscriptions.
export const ORG_ADMIN_ID = '001bde00-57e8-4918-8c53-f596e0efbddb'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function isExemptFromPaywall(supabase: any, coachId: string): Promise<boolean> {
  if (coachId === ORG_ADMIN_ID) return true
  const { data } = await supabase.from('org_members').select('id').eq('user_id', coachId).limit(1)
  return !!data?.length
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
