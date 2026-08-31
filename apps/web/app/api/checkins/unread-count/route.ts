import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Counts weekly check-ins from this coach's clients that haven't been
// opened yet (no checkin_feedback row, or one whose viewed_at is still
// null). Scoped to type='weekly' to match what the badge sits next to —
// Ukentlig oversikt only ever shows weekly check-ins, never daily ones, so
// counting daily quick-logs here inflated the badge with things that page
// can't even display (daily check-ins have no per-item "open" action
// anywhere, so they'd almost never get marked read, growing forever) and
// pushed the count past its 99+ display cap for no actionable reason.
// Deliberately independent of calendar week, unlike Ukentlig oversikt's own
// Mon–Sun bucketing — a Sunday-night submission still counts as unread here
// even after it's buried in "last week" until a coach clicks back to it.
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
    .eq('type', 'weekly')
    .gte('created_at', since)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const count = (checkins ?? []).filter(c => {
    const fb = Array.isArray(c.feedback) ? c.feedback[0] : c.feedback
    return !fb?.viewed_at
  }).length

  return NextResponse.json({ count })
}
