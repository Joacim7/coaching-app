import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// PATCH /api/organization/clients/[relId] — org admin only.
// Reassigns a client to a different coach within the same organization.
// Body: { coachId: string }
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ relId: string }> },
) {
  const { relId } = await params
  const supabase = await createClient()
  const admin    = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { coachId: newCoachId } = await req.json()
  if (!newCoachId) return NextResponse.json({ error: 'Coach mangler' }, { status: 400 })

  // The new coach must be a member of the same org
  const { data: newCoachMembership } = await admin
    .from('org_members')
    .select('user_id')
    .eq('org_id', membership.org_id)
    .eq('user_id', newCoachId)
    .single()

  if (!newCoachMembership)
    return NextResponse.json({ error: 'Coachen er ikke medlem av organisasjonen' }, { status: 400 })

  // The relation being changed must currently belong to a coach in this org too —
  // stops an admin from one org reassigning a coach_clients row from another org
  const { data: rel } = await admin
    .from('coach_clients')
    .select('id, coach_id')
    .eq('id', relId)
    .single()

  if (!rel) return NextResponse.json({ error: 'Fant ikke klientforhold' }, { status: 404 })

  const { data: currentCoachMembership } = await admin
    .from('org_members')
    .select('user_id')
    .eq('org_id', membership.org_id)
    .eq('user_id', rel.coach_id)
    .single()

  if (!currentCoachMembership)
    return NextResponse.json({ error: 'Klienten tilhører ikke din organisasjon' }, { status: 403 })

  const { error } = await admin
    .from('coach_clients')
    .update({ coach_id: newCoachId })
    .eq('id', relId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
