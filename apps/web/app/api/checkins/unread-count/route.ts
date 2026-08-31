import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Counts check-ins from this coach's clients that haven't been opened yet
// (no checkin_feedback row, or one whose viewed_at is still null). This is
// deliberately independent of calendar week and check-in type — Ukentlig
// oversikt buckets weekly check-ins by Mon–Sun and can bury a Sunday-night
// submission in "last week" until a coach thinks to click back, and it
// never shows daily check-ins at all. This count is what actually answers
// "has a client sent something I haven't seen yet".
const LOOKBACK_DAYS = 90

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 })

  const { data: clientLinks } = await supabase
    .from('coach_clients')
    .select('client_id')
    .eq('coach_id', user.id)
    .neq('status', 'inactive')

  const clientIds = (clientLinks ?? []).map(c => c.client_id)
  if (clientIds.length === 0) return NextResponse.json({ count: 0 })

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: checkins, error } = await supabase
    .from('checkins')
    .select('id, feedback:checkin_feedback(viewed_at)')
    .in('client_id', clientIds)
    .gte('created_at', since)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const count = (checkins ?? []).filter(c => {
    const fb = Array.isArray(c.feedback) ? c.feedback[0] : c.feedback
    return !fb?.viewed_at
  }).length

  return NextResponse.json({ count })
}
