import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDeletableTestCoach } from '@/lib/adminTestCoach'

// Same hardcoded restriction as /admin itself.
const ADMIN_COACH_ID = '001bde00-57e8-4918-8c53-f596e0efbddb'

// DELETE /api/admin/coaches/[coachId] — hard-deletes a coach and everything
// they own. Only reachable by the platform admin, and only for accounts
// that pass isDeletableTestCoach (re-checked here, not just in the UI).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ coachId: string }> },
) {
  const { coachId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== ADMIN_COACH_ID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (coachId === ADMIN_COACH_ID) {
    return NextResponse.json({ error: 'Kan ikke slette admin-kontoen' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', coachId)
    .single()

  if (!profile || profile.role !== 'coach') {
    return NextResponse.json({ error: 'Fant ikke coachen' }, { status: 404 })
  }

  const { data: authUserRes } = await admin.auth.admin.getUserById(coachId)
  const email = authUserRes?.user?.email ?? null

  if (!isDeletableTestCoach(email)) {
    return NextResponse.json(
      { error: 'Denne coachen har en ekte e-post og er ikke markert som test — kan ikke slettes herfra' },
      { status: 403 },
    )
  }

  // Refuse to cascade away an organization that still has other members —
  // organizations.created_by references profiles(id) ON DELETE CASCADE, so
  // deleting this coach would wipe the whole org (and every other member's
  // access) along with them if they created a shared one.
  const { data: createdOrgs } = await admin
    .from('organizations')
    .select('id, name')
    .eq('created_by', coachId)

  for (const org of createdOrgs ?? []) {
    const { count } = await admin
      .from('org_members')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', org.id)
      .neq('user_id', coachId)
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: `Coachen eier organisasjonen "${org.name}" som har andre medlemmer — flytt eller slett organisasjonen først` },
        { status: 409 },
      )
    }
  }

  // profiles.id has ON DELETE CASCADE from every table that references it
  // (training_plans, meal_plans, client_phases, client_goals,
  // client_contracts, checkin_templates, exercises, recordings,
  // coach_documents, leads, org_members, coach_clients, ...) — deleting the
  // profile cleans up everything the coach owns. It does NOT touch their
  // clients' own profiles or data, only the coach_clients relationship.
  const { error: deleteProfileError } = await admin.from('profiles').delete().eq('id', coachId)
  if (deleteProfileError) {
    return NextResponse.json({ error: deleteProfileError.message }, { status: 500 })
  }

  const { error: deleteAuthError } = await admin.auth.admin.deleteUser(coachId)
  if (deleteAuthError) {
    return NextResponse.json(
      { error: `Coach-data slettet, men klarte ikke slette auth-kontoen: ${deleteAuthError.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
