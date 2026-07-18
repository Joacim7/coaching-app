// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getOrgSharedIds(supabase: any, userId: string, resourceType: string): Promise<string[]> {
  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .single()

  if (!membership?.org_id) return []

  const { data: shared } = await supabase
    .from('org_shared_resources')
    .select('resource_id')
    .eq('org_id', membership.org_id)
    .eq('resource_type', resourceType)

  return (shared ?? []).map((r: { resource_id: string }) => r.resource_id)
}
