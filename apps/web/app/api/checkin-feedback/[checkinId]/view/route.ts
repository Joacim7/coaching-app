import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Called when a coach opens a submitted check-in for the first time.
// Creates the feedback row (with viewed_at) if none exists; does nothing if already viewed.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ checkinId: string }> }
) {
  const { checkinId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify coach owns this client's check-in
  const { data: checkin } = await supabase
    .from('checkins')
    .select('client_id')
    .eq('id', checkinId)
    .single()

  if (!checkin) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: rel } = await supabase
    .from('coach_clients')
    .select('id')
    .eq('coach_id', user.id)
    .eq('client_id', checkin.client_id)
    .single()

  if (!rel) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const now = new Date().toISOString()

  // Check if feedback row already exists
  const { data: existing } = await supabase
    .from('checkin_feedback')
    .select('id, viewed_at')
    .eq('checkin_id', checkinId)
    .single()

  if (!existing) {
    // First open — create row with viewed_at
    await supabase.from('checkin_feedback').insert({
      checkin_id: checkinId,
      coach_id:   user.id,
      viewed_at:  now,
      updated_at: now,
    })
  } else if (!existing.viewed_at) {
    // Row exists but was never marked as viewed (edge case)
    await supabase
      .from('checkin_feedback')
      .update({ viewed_at: now })
      .eq('checkin_id', checkinId)
  }

  return NextResponse.json({ ok: true })
}
