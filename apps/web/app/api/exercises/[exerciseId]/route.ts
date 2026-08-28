import { createClient } from '@/lib/supabase/server'
import { ORG_ADMIN_ID } from '@/lib/paywall'
import { NextResponse } from 'next/server'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ exerciseId: string }> },
) {
  const { exerciseId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 })

  const { data: membership } = await supabase
    .from('org_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle()
  const isOrgAdmin = !!membership

  // Org admins may delete standard exercises too; other coaches only their own.
  let query = supabase.from('exercises').delete().eq('id', exerciseId)
  query = isOrgAdmin
    ? query.or(`coach_id.eq.${user.id},is_standard.eq.true`)
    : query.eq('coach_id', user.id).eq('is_standard', false)

  const { error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ exerciseId: string }> },
) {
  const { exerciseId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 })

  const body = await req.json() as Record<string, unknown>

  // Only the platform owner may (re)designate an exercise as standard or
  // reassign its coach — strip both from anyone else's payload so a regular
  // coach can't elevate their own exercise into the shared library via a
  // direct API call. Which row this is actually allowed to touch (their own
  // vs. a standard exercise the owner is editing in place) is enforced by
  // RLS, not this filter.
  if (user.id !== ORG_ADMIN_ID) {
    delete body.is_standard
    delete body.coach_id
  }

  const { data, error } = await supabase
    .from('exercises')
    .update(body)
    .eq('id', exerciseId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
