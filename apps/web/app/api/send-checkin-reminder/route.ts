import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendCheckinReminder } from '@/lib/email'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { clientId } = await req.json()
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  // Verify the coach owns this client
  const { data: rel } = await supabase
    .from('coach_clients')
    .select('id')
    .eq('coach_id', user.id)
    .eq('client_id', clientId)
    .single()

  if (!rel) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Fetch client email + name and coach name in parallel
  const [clientRes, coachRes] = await Promise.all([
    supabase.from('profiles').select('full_name, email').eq('id', clientId).single(),
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
  ])

  const client = clientRes.data
  const coach  = coachRes.data

  if (!client?.email) {
    return NextResponse.json({ ok: false, reason: 'no_email' })
  }

  // Find their weekly template name if available
  const { data: template } = await supabase
    .from('checkin_templates')
    .select('name, schedule_time')
    .eq('coach_id', user.id)
    .eq('type', 'weekly')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const result = await sendCheckinReminder({
    to:            client.email,
    clientName:    client.full_name,
    coachName:     coach?.full_name ?? 'Treneren din',
    templateName:  template?.name ?? 'Ukentlig innsjekk',
    scheduledTime: template?.schedule_time?.slice(0, 5) ?? '',
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
