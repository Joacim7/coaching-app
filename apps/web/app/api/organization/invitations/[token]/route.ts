import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/organization/invitations/[token] — public lookup, used by the
// register page to prefill the invited email and show the org name before
// the visitor has an account (so no auth check here, unlike /accept).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: inv, error } = await admin
    .from('org_invitations')
    .select('email, status, expires_at, organization:organizations(name)')
    .eq('token', token)
    .single()

  if (error || !inv) return NextResponse.json({ error: 'Ugyldig invitasjon' }, { status: 404 })

  const org = Array.isArray(inv.organization) ? inv.organization[0] : inv.organization
  const expired = inv.status === 'pending' && new Date(inv.expires_at) < new Date()

  return NextResponse.json({
    email:   inv.email,
    orgName: org?.name ?? 'organisasjonen',
    valid:   inv.status === 'pending' && !expired,
    status:  expired ? 'expired' : inv.status,
  })
}
