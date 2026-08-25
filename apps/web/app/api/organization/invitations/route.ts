import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendOrgInviteEmail } from '@/lib/email'

// POST /api/organization/invitations — invite a coach by email
export async function POST(req: Request) {
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

  const { email } = await req.json()
  if (!email?.trim()) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  // A pending invitation reserves a seat just like an active member does —
  // otherwise an admin could send far more invites than the plan allows and
  // blow past the limit the moment they're all accepted.
  const { data: orgRow } = await supabase
    .from('organizations')
    .select('max_coaches')
    .eq('id', membership.org_id)
    .single()

  const [{ count: memberCount }, { count: pendingCount }] = await Promise.all([
    supabase.from('org_members').select('id', { count: 'exact', head: true }).eq('org_id', membership.org_id),
    supabase.from('org_invitations').select('id', { count: 'exact', head: true }).eq('org_id', membership.org_id).eq('status', 'pending'),
  ])

  const seatsUsed = (memberCount ?? 0) + (pendingCount ?? 0)
  if (orgRow && seatsUsed >= orgRow.max_coaches) {
    return NextResponse.json(
      {
        error: `Planen din tillater maks ${orgRow.max_coaches} coacher. Oppgrader planen for å invitere flere.`,
        code: 'plan_limit_reached',
      },
      { status: 402 },
    )
  }

  const { data, error } = await supabase
    .from('org_invitations')
    .insert({
      org_id:     membership.org_id,
      email:      email.trim().toLowerCase(),
      invited_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const [{ data: org }, { data: inviter }] = await Promise.all([
    supabase.from('organizations').select('name').eq('id', membership.org_id).single(),
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
  ])

  const result = await sendOrgInviteEmail({
    to:          data.email,
    orgName:     org?.name ?? 'organisasjonen',
    inviterName: inviter?.full_name ?? 'En administrator',
    inviteToken: data.token,
  })
  if (!result.ok) console.error('[org-invite] email send failed:', result.error)

  return NextResponse.json(data, { status: 201 })
}

// DELETE /api/organization/invitations — cancel an invitation
export async function DELETE(req: Request) {
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

  const { id } = await req.json()
  await supabase.from('org_invitations').delete().eq('id', id).eq('org_id', membership.org_id)
  return NextResponse.json({ ok: true })
}
