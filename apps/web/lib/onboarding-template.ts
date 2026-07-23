import type { CheckinTemplate } from '@coaching/types'

/**
 * Resolves the onboarding check-in template a coach's clients should get:
 * the coach's own 'onboarding' template if they have one, otherwise the most
 * recently shared 'onboarding' template in their organization (if any).
 *
 * Non-admin coaches often don't have their own template — the org admin
 * creates one and shares it via org_shared_resources, expecting every coach
 * in the org to reuse it. Without this fallback, invited clients silently
 * got no onboarding form at all.
 *
 * Works with either the admin (service-role) client or a regular
 * request-scoped client — both expose the same query surface.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getEffectiveOnboardingTemplate(supabase: any, coachId: string): Promise<CheckinTemplate | null> {
  const { data: own } = await supabase
    .from('checkin_templates')
    .select('*')
    .eq('coach_id', coachId)
    .eq('type', 'onboarding')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (own) return own as CheckinTemplate

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', coachId)
    .single()

  if (!membership) return null

  const { data: sharedIds } = await supabase
    .from('org_shared_resources')
    .select('resource_id')
    .eq('org_id', membership.org_id)
    .eq('resource_type', 'checkin_template')

  if (!sharedIds?.length) return null

  const { data: shared } = await supabase
    .from('checkin_templates')
    .select('*')
    .in('id', sharedIds.map((r: { resource_id: string }) => r.resource_id))
    .eq('type', 'onboarding')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return (shared as CheckinTemplate) ?? null
}
