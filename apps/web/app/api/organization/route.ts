import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/organization — returns current user's org + stats, or null
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Find membership
  const { data: membership } = await supabase
    .from('org_members')
    .select('role, org_id, organizations(id, name, max_coaches, created_at, created_by)')
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json(null)

  const org = membership.organizations as unknown as {
    id: string; name: string; max_coaches: number; created_at: string; created_by: string
  }

  // Get coach user_ids in org first, then count their clients
  const { data: orgMemberIds } = await supabase
    .from('org_members')
    .select('user_id')
    .eq('org_id', org.id)

  const coachIds = (orgMemberIds ?? []).map(m => m.user_id)

  const [coachesRes, invitationsRes, clientsRes] = await Promise.all([
    supabase
      .from('org_members')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', org.id),
    supabase
      .from('org_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', org.id)
      .eq('status', 'pending'),
    coachIds.length > 0
      ? supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'client')
          .in('coach_id', coachIds)
      : Promise.resolve({ count: 0 }),
  ])

  return NextResponse.json({
    organization: org,
    membership: { role: membership.role },
    stats: {
      coachCount:          coachesRes.count    ?? 0,
      maxCoaches:          org.max_coaches,
      totalClients:        clientsRes.count    ?? 0,
      pendingInvitations:  invitationsRes.count ?? 0,
    },
  })
}

// POST /api/organization — create a new org via SECURITY DEFINER function
// (direct INSERT fails RLS when auth.uid() isn't resolved server-side)
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const { data, error } = await supabase.rpc('create_organization', { p_name: name.trim() })

  if (error) {
    if (error.message.includes('Already in')) return NextResponse.json({ error: 'Already in an organization' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

// PATCH /api/organization — update org name (admin only)
export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const { data, error } = await supabase
    .from('organizations')
    .update({ name: name.trim() })
    .eq('id', membership.org_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
