import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/organization/invitations/accept
// Body: { token: string }
export async function POST(req: Request) {
  const supabase      = await createClient()
  const admin         = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'Token mangler' }, { status: 400 })

  // Look up invitation via admin (bypasses RLS — invited user is not yet a member)
  const { data: inv, error: invErr } = await admin
    .from('org_invitations')
    .select('id, org_id, role, status, expires_at, email')
    .eq('token', token)
    .single()

  if (invErr || !inv) return NextResponse.json({ error: 'Ugyldig invitasjon' }, { status: 404 })
  if (inv.status !== 'pending') return NextResponse.json({ error: 'Invitasjonen er allerede brukt eller avbrutt' }, { status: 409 })
  if (new Date(inv.expires_at) < new Date()) return NextResponse.json({ error: 'Invitasjonen er utløpt' }, { status: 410 })
  if (inv.email.toLowerCase() !== (user.email ?? '').toLowerCase()) {
    return NextResponse.json({ error: 'Denne invitasjonen ble sendt til en annen e-postadresse' }, { status: 403 })
  }

  // Check not already a member
  const { data: existing } = await admin
    .from('org_members')
    .select('id')
    .eq('org_id', inv.org_id)
    .eq('user_id', user.id)
    .single()

  if (existing) return NextResponse.json({ error: 'Du er allerede medlem av denne organisasjonen' }, { status: 409 })

  // Add to org
  const { error: insertErr } = await admin
    .from('org_members')
    .insert({ org_id: inv.org_id, user_id: user.id, role: inv.role })

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  // Mark invitation as accepted
  await admin.from('org_invitations').update({ status: 'accepted' }).eq('id', inv.id)

  return NextResponse.json({ ok: true })
}
