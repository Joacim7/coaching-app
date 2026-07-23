import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendOnboardingForm } from '@/lib/email'
import type { CheckinTemplate } from '@coaching/types'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 })

  const { clientId } = await params

  const { data: rel } = await supabase
    .from('coach_clients')
    .select('client_id')
    .eq('coach_id', user.id)
    .eq('client_id', clientId)
    .single()

  if (!rel) return NextResponse.json({ error: 'Fant ikke klient' }, { status: 404 })

  const [{ data: profile }, { data: coachProfile }, { data: tplRaw }] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, email, onboarding_token')
      .eq('id', clientId)
      .single(),
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single(),
    supabase
      .from('checkin_templates')
      .select('*')
      .eq('coach_id', user.id)
      .eq('type', 'onboarding')
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
  ])

  const template = tplRaw as CheckinTemplate | null
  if (!template) {
    return NextResponse.json({ error: 'Ingen onboarding-skjema er satt opp' }, { status: 400 })
  }
  if (!profile?.email || !profile.onboarding_token) {
    return NextResponse.json({ error: 'Klienten mangler e-postadresse' }, { status: 400 })
  }

  const result = await sendOnboardingForm({
    to:              profile.email,
    clientName:      profile.full_name ?? 'Klient',
    coachName:       coachProfile?.full_name ?? 'Treneren din',
    template,
    onboardingToken: profile.onboarding_token,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Kunne ikke sende e-post' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
