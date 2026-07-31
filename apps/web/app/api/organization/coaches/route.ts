import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/organization/coaches — list all coaches in the org
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json([])

  const { data: members } = await supabase
    .from('org_members')
    .select('id, role, joined_at, user_id, profiles!user_id(full_name, email)')
    .eq('org_id', membership.org_id)
    .order('joined_at')

  // Pending invitations are admin-only — regular coaches don't need to see
  // (or be able to infer) who else has been invited but hasn't joined yet.
  let invitations: unknown[] = []
  if (membership.role === 'admin') {
    const { data } = await supabase
      .from('org_invitations')
      .select('id, email, role, status, token, created_at, expires_at')
      .eq('org_id', membership.org_id)
      .order('created_at', { ascending: false })
    invitations = data ?? []
  }

  return NextResponse.json({ members: members ?? [], invitations })
}

// DELETE /api/organization/coaches — remove a coach from the org
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
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data: target } = await supabase
    .from('org_members')
    .select('id, org_id, user_id')
    .eq('id', id)
    .eq('org_id', membership.org_id)
    .single()

  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (target.user_id === user.id)
    return NextResponse.json({ error: 'Du kan ikke fjerne deg selv' }, { status: 400 })

  const { count } = await supabase
    .from('coach_clients')
    .select('id', { count: 'exact', head: true })
    .eq('coach_id', target.user_id)
    .eq('status', 'active')

  if (count && count > 0)
    return NextResponse.json(
      { error: 'Coachen har fortsatt aktive klienter. Overfør klientene til en annen coach først.' },
      { status: 409 },
    )

  const { error } = await supabase
    .from('org_members')
    .delete()
    .eq('id', id)
    .eq('org_id', membership.org_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
