import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/organization/clients — org admin only
export async function GET() {
  const supabase = await createClient()
  const admin    = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify caller is an org admin
  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Get all coaches in org
  const { data: orgMembers } = await admin
    .from('org_members')
    .select('user_id, profiles:profiles!user_id(full_name)')
    .eq('org_id', membership.org_id)

  const coachIds = (orgMembers ?? []).map(m => m.user_id)
  const coachNameMap = new Map<string, string>()
  for (const m of orgMembers ?? []) {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
    coachNameMap.set(m.user_id, (p as { full_name: string | null } | null)?.full_name ?? 'Ukjent')
  }

  if (!coachIds.length) return NextResponse.json([])

  // Get all coach_clients for all org coaches
  const { data: relations } = await admin
    .from('coach_clients')
    .select('id, coach_id, client_id, status, created_at, profiles:profiles!client_id(id, full_name)')
    .in('coach_id', coachIds)
    .order('created_at', { ascending: false })

  const rows = (relations ?? []).flatMap(rel => {
    const profile = Array.isArray(rel.profiles) ? rel.profiles[0] : rel.profiles
    if (!profile?.id) return []
    return [{
      id:        rel.id,
      profileId: profile.id,
      name:      (profile as { full_name: string | null }).full_name ?? 'Ukjent',
      status:    rel.status ?? 'active',
      coachId:   rel.coach_id,
      coachName: coachNameMap.get(rel.coach_id) ?? 'Ukjent',
      joinedAt:  rel.created_at,
    }]
  })

  return NextResponse.json(rows)
}
