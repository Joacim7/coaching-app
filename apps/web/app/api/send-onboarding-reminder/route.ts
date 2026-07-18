import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendOnboardingForm } from '@/lib/email'
import type { CheckinTemplate } from '@coaching/types'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Coach name
  const { data: coachProfile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  // Coach's onboarding template
  const { data: tplRaw } = await supabase
    .from('checkin_templates')
    .select('*')
    .eq('coach_id', user.id)
    .eq('type', 'onboarding')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const template = tplRaw as CheckinTemplate | null

  if (!template) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no_template' })
  }

  // All "onboarding" status clients (form was sent but not yet completed)
  const { data: waitingLinks } = await supabase
    .from('coach_clients')
    .select('client_id')
    .eq('coach_id', user.id)
    .eq('status', 'onboarding')

  if (!waitingLinks?.length) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  const clientIds = waitingLinks.map(l => l.client_id)

  // Exclude those who already submitted
  const { data: existing } = await supabase
    .from('onboarding_submissions')
    .select('client_id')
    .in('client_id', clientIds)

  const submitted = new Set((existing ?? []).map(s => s.client_id))
  const needsReminder = clientIds.filter(id => !submitted.has(id))

  if (!needsReminder.length) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  // Fetch their profiles (email + onboarding_token)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email, onboarding_token')
    .in('id', needsReminder)

  let sent = 0
  for (const p of (profiles ?? [])) {
    if (!p.email || !p.onboarding_token) continue
    const result = await sendOnboardingForm({
      to:              p.email,
      clientName:      p.full_name ?? 'Klient',
      coachName:       coachProfile?.full_name ?? 'Treneren din',
      template,
      onboardingToken: p.onboarding_token,
    })
    if (result.ok) sent++
  }

  return NextResponse.json({ ok: true, sent })
}
