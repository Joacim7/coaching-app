import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendCheckinReminder } from '@/lib/email'

// Vercel sets this header automatically on cron invocations.
// Set CRON_SECRET in your Vercel environment variables.
function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

// JS getUTCDay(): 0=Sun … 6=Sat  →  our encoding: 0=Mon … 6=Sun
function jsUTCDayToOurDay(jsDay: number): number {
  return (jsDay + 6) % 7
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now         = new Date()
  const currentDay  = jsUTCDayToOurDay(now.getUTCDay())   // 0=Mon … 6=Sun
  const todayISO    = now.toISOString().slice(0, 10)       // "YYYY-MM-DD"

  let supabase: ReturnType<typeof createAdminClient>
  try {
    supabase = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 500 })
  }

  // ── 1. Find weekly templates scheduled for today's day ───────────────────────
  // PostgREST `cs` operator → PostgreSQL @> (array contains)
  const { data: templates, error: tErr } = await supabase
    .from('checkin_templates')
    .select(`
      id,
      name,
      coach_id,
      schedule_days,
      schedule_time,
      coach:profiles!coach_id ( full_name )
    `)
    .eq('type', 'weekly')
    .not('schedule_time', 'is', null)
    .filter('schedule_days', 'cs', `{${currentDay}}`)

  if (tErr) {
    console.error('[cron] fetch templates error:', tErr.message)
    return NextResponse.json({ error: tErr.message }, { status: 500 })
  }

  // ── 2. All templates scheduled for today are due — cron runs once daily now,
  // so we send every check-in due today regardless of its configured hour.
  const due = templates ?? []

  if (due.length === 0) {
    return NextResponse.json({ dispatched: 0, templates: [], timestamp: now.toISOString() })
  }

  // ── 3. For each due template, schedule check-ins for all active clients ──────
  const results: Array<{ templateName: string; dispatched: number; skipped: number }> = []

  for (const template of due) {
    // Fetch all clients of this coach (active or new — exclude only explicitly inactive)
    const { data: links } = await supabase
      .from('coach_clients')
      .select(`
        client_id,
        client:profiles!client_id ( full_name, email, onboarding_token )
      `)
      .eq('coach_id', template.coach_id)
      .neq('status', 'inactive')

    if (!links?.length) {
      results.push({ templateName: template.name, dispatched: 0, skipped: 0 })
      continue
    }

    // Find clients already scheduled today (deduplication)
    const clientIds = links.map(l => l.client_id)
    const { data: alreadySent } = await supabase
      .from('scheduled_checkins')
      .select('client_id')
      .eq('template_id', template.id)
      .eq('scheduled_date', todayISO)
      .in('client_id', clientIds)

    const alreadySentSet = new Set((alreadySent ?? []).map(r => r.client_id))
    const pending = links.filter(l => !alreadySentSet.has(l.client_id))

    if (pending.length === 0) {
      results.push({ templateName: template.name, dispatched: 0, skipped: links.length })
      continue
    }

    // Insert scheduled_checkins rows (ON CONFLICT DO NOTHING as safety net)
    const rows = pending.map(l => ({
      template_id:    template.id,
      client_id:      l.client_id,
      scheduled_date: todayISO,
      email_sent:     false,
    }))

    const { error: insertErr } = await supabase
      .from('scheduled_checkins')
      .insert(rows)
      .select()

    if (insertErr) {
      console.error('[cron] insert error for template', template.id, insertErr.message)
      results.push({ templateName: template.name, dispatched: 0, skipped: pending.length })
      continue
    }

    // ── 4. Send email reminders to clients who have email addresses ────────────
    const coachRaw  = template.coach as unknown as { full_name: string } | null
    const coachName = coachRaw?.full_name ?? 'Treneren din'
    const timeLabel = (template.schedule_time as string).slice(0, 5)    // "HH:MM"
    let emailsSent = 0

    for (const link of pending) {
      const clientRaw = link.client as unknown as { full_name: string; email: string | null } | null
      const client    = clientRaw
      if (!client?.email) continue

      const { ok } = await sendCheckinReminder({
        to:            client.email,
        clientName:    client.full_name,
        coachName,
        templateName:  template.name,
        scheduledTime: timeLabel,
      })

      if (ok) {
        emailsSent++
        // Mark email_sent = true
        await supabase
          .from('scheduled_checkins')
          .update({ email_sent: true })
          .eq('template_id', template.id)
          .eq('client_id', link.client_id)
          .eq('scheduled_date', todayISO)
      }
    }

    results.push({
      templateName: template.name,
      dispatched:   pending.length,
      skipped:      alreadySentSet.size,
    })

    console.log(
      `[cron] template "${template.name}": ${pending.length} scheduled, ${emailsSent} emails sent`
    )
  }

  const totalDispatched = results.reduce((s, r) => s + r.dispatched, 0)

  return NextResponse.json({
    dispatched: totalDispatched,
    templates:  results,
    timestamp:  now.toISOString(),
  })
}
