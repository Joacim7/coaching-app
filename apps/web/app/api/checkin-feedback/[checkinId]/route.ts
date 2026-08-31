import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendExpoPushNotification } from '@/lib/push-notifications'
import { NextResponse } from 'next/server'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ checkinId: string }> }
) {
  const { checkinId } = await params
  const supabase      = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { comment, videoLink, isComplete } = await req.json()

  // Verify the coach actually owns this client's check-in
  const { data: checkin } = await supabase
    .from('checkins')
    .select('client_id, type')
    .eq('id', checkinId)
    .single()

  if (!checkin) return NextResponse.json({ error: 'Checkin not found' }, { status: 404 })

  const { data: rel } = await supabase
    .from('coach_clients')
    .select('id')
    .eq('coach_id', user.id)
    .eq('client_id', checkin.client_id)
    .single()

  if (!rel) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Needed to tell a genuine false→true completion (worth notifying the
  // client about) apart from a resend of one that was already complete —
  // the UI now disables re-sending once complete, but this is the
  // authoritative guard: without it, any stray duplicate request (a second
  // tab, a race, a retried request) would re-push the client every time.
  const { data: existingFeedback } = await supabase
    .from('checkin_feedback')
    .select('is_complete')
    .eq('checkin_id', checkinId)
    .maybeSingle()
  const wasAlreadyComplete = existingFeedback?.is_complete ?? false

  // Upsert — one feedback row per check-in
  const { error } = await supabase
    .from('checkin_feedback')
    .upsert(
      {
        checkin_id:  checkinId,
        coach_id:    user.id,
        comment:     comment     ?? null,
        video_link:  videoLink   ?? null,
        is_complete: isComplete  ?? false,
        updated_at:  new Date().toISOString(),
      },
      { onConflict: 'checkin_id' }
    )

  if (error) {
    console.error('[checkin-feedback] upsert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Push the client only on the actual false→true completion, never for a
  // draft save (a draft isn't even visible to the client yet — see the
  // clients_read_own_checkin_feedback RLS policy's is_complete gate) or a
  // resend of one that was already complete.
  if (isComplete && !wasAlreadyComplete && checkin.type === 'weekly') {
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('expo_push_token')
      .eq('id', checkin.client_id)
      .single()

    if (profile?.expo_push_token) {
      const result = await sendExpoPushNotification({
        to: profile.expo_push_token,
        title: 'Nova Performance',
        body: 'Din coach har svart på din ukentlige check-in',
      })
      if (!result.ok) console.error('[checkin-feedback] push failed:', result.error)
    }
  }

  return NextResponse.json({ ok: true })
}
