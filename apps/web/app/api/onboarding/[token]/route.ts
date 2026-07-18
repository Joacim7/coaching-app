import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const { clientId, templateId, answers } = await req.json()

  if (!clientId || !answers) {
    return NextResponse.json({ error: 'Mangler data' }, { status: 400 })
  }

  // Anonymous visitor — no session, so this must bypass RLS. The token
  // match below is the only authorization check for this public endpoint.
  const admin = createAdminClient()

  // Verify the token matches the clientId — prevents submitting on behalf of others
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('id', clientId)
    .eq('onboarding_token', token)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Ugyldig lenke' }, { status: 403 })
  }

  // Prevent duplicate submissions
  const { data: existing } = await admin
    .from('onboarding_submissions')
    .select('id')
    .eq('client_id', clientId)
    .limit(1)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Skjema allerede innsendt' }, { status: 409 })
  }

  const { error } = await admin
    .from('onboarding_submissions')
    .insert({ client_id: clientId, template_id: templateId ?? null, answers })

  if (error) {
    console.error('[onboarding] submit error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
