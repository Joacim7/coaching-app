import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ clientId: string }> }

// GET — return client profile settings + available coaches
export async function GET(_req: Request, { params }: Params) {
  const { clientId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify this coach owns the client relationship
  const { data: rel } = await supabase
    .from('coach_clients')
    .select('coach_id')
    .eq('coach_id', user.id)
    .eq('client_id', clientId)
    .single()

  if (!rel) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Client profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, app_access')
    .eq('id', clientId)
    .single()

  // Available coaches: org members if in an org, otherwise just self
  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  let coaches: { id: string; full_name: string | null; email: string | null }[] = []

  if (membership) {
    const { data: orgMembers } = await supabase
      .from('org_members')
      .select('user_id, profiles!user_id(id, full_name, email)')
      .eq('org_id', membership.org_id)

    coaches = (orgMembers ?? []).map(m => {
      const p = m.profiles as unknown as { id: string; full_name: string | null; email: string | null }
      return { id: p.id, full_name: p.full_name, email: p.email }
    })
  } else {
    const { data: self } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', user.id)
      .single()
    if (self) coaches = [self]
  }

  return NextResponse.json({
    profile,
    currentCoachId: rel.coach_id,
    coaches,
  })
}

// PATCH — update contact info, app_access, and/or responsible coach
export async function PATCH(req: Request, { params }: Params) {
  const { clientId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership
  const { data: rel } = await supabase
    .from('coach_clients')
    .select('id, coach_id')
    .eq('coach_id', user.id)
    .eq('client_id', clientId)
    .single()

  if (!rel) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json() as {
    full_name?:          string
    email?:              string
    phone?:              string
    app_access?:         boolean
    responsible_coach_id?: string
  }

  const results: Record<string, unknown> = {}

  // Update profile fields
  const profileUpdate: Record<string, unknown> = {}
  if (body.full_name  !== undefined) profileUpdate.full_name  = body.full_name.trim()
  if (body.email      !== undefined) profileUpdate.email      = body.email.trim() || null
  if (body.phone      !== undefined) profileUpdate.phone      = body.phone.trim() || null
  if (body.app_access !== undefined) profileUpdate.app_access = body.app_access

  if (Object.keys(profileUpdate).length > 0) {
    const { error } = await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', clientId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    results.profile = 'updated'
  }

  // Reassign responsible coach
  if (body.responsible_coach_id && body.responsible_coach_id !== rel.coach_id) {
    // Validate target coach is in same org (or is current coach)
    const { data: membership } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .single()

    if (membership) {
      const { data: targetMember } = await supabase
        .from('org_members')
        .select('user_id')
        .eq('org_id', membership.org_id)
        .eq('user_id', body.responsible_coach_id)
        .single()

      if (!targetMember) return NextResponse.json({ error: 'Coach not in org' }, { status: 400 })
    }

    const { error } = await supabase
      .from('coach_clients')
      .update({ coach_id: body.responsible_coach_id })
      .eq('id', rel.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    results.coach = 'reassigned'
  }

  return NextResponse.json({ ok: true, ...results })
}

// DELETE — permanently remove the client and all their data
export async function DELETE(_req: Request, { params }: Params) {
  const { clientId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership
  const { data: rel } = await supabase
    .from('coach_clients')
    .select('id')
    .eq('coach_id', user.id)
    .eq('client_id', clientId)
    .single()

  if (!rel) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // profiles has no coach-facing DELETE policy (by design — deletion is only
  // ever done through this ownership-checked route), so this needs the
  // service-role client to actually bypass RLS and perform the delete.
  const admin = createAdminClient()

  // Remove the Supabase Auth account too, if the client ever set a password
  // (manually-added clients who never finished onboarding won't have one).
  const { error: authDeleteErr } = await admin.auth.admin.deleteUser(clientId)
  if (authDeleteErr) {
    console.warn('[clients/settings DELETE] auth user delete failed (may not have had an account):', authDeleteErr.message)
  }

  // Deleting the profile cascades to every table that references it
  // (training plans, meal plans, check-ins, workout/food logs, contracts, etc.)
  const { error } = await admin
    .from('profiles')
    .delete()
    .eq('id', clientId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
