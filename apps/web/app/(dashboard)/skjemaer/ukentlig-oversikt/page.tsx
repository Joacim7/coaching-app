import { createClient } from '@/lib/supabase/server'
import { WeeklyOverviewView, type ClientRow } from './weekly-view'

// ── Week helpers ──────────────────────────────────────────────────────────────

function getWeekBounds(offsetWeeks: number) {
  const now    = new Date()
  const utcDay = now.getUTCDay()                    // 0=Sun … 6=Sat
  const daysFromMonday = (utcDay + 6) % 7           // 0=Mon … 6=Sun

  const monday = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(),
    now.getUTCDate() - daysFromMonday + offsetWeeks * 7,
  ))
  const sunday = new Date(Date.UTC(
    monday.getUTCFullYear(), monday.getUTCMonth(),
    monday.getUTCDate() + 6,
    23, 59, 59, 999,
  ))
  return { monday, sunday }
}

const MONTHS_NO = ['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des']

function weekLabel(monday: Date, sunday: Date) {
  const md = monday.getUTCDate(), mm = MONTHS_NO[monday.getUTCMonth()]
  const sd = sunday.getUTCDate(), sm = MONTHS_NO[sunday.getUTCMonth()]
  const yr = sunday.getUTCFullYear()
  return monday.getUTCMonth() === sunday.getUTCMonth()
    ? `${md}. – ${sd}. ${sm} ${yr}`
    : `${md}. ${mm} – ${sd}. ${sm} ${yr}`
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function UkentligOversiktPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>
}) {
  const { w } = await searchParams
  const weekOffset = Math.max(-52, Math.min(0, parseInt(w ?? '0', 10) || 0))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { monday, sunday } = getWeekBounds(weekOffset)
  const label = weekLabel(monday, sunday)

  // 1. All active clients for this coach (with email for reminders)
  const { data: clientLinks } = await supabase
    .from('coach_clients')
    .select('client_id, profile:profiles!client_id(full_name, email)')
    .eq('coach_id', user!.id)
    .neq('status', 'inactive')

  const clients = (clientLinks ?? []).map(l => {
    const p = Array.isArray(l.profile) ? l.profile[0] : l.profile
    return { id: l.client_id, name: p?.full_name ?? 'Ukjent', email: p?.email ?? null }
  })

  if (clients.length === 0) {
    return (
      <WeeklyOverviewView
        rows={[]}
        weekLabel={label}
        weekOffset={weekOffset}
        isCurrentWeek={weekOffset === 0}
      />
    )
  }

  const clientIds = clients.map(c => c.id)

  // 2. Weekly check-ins submitted this week
  const { data: checkins } = await supabase
    .from('checkins')
    .select(`
      id, client_id, created_at, answers,
      template:checkin_templates ( name, questions ),
      feedback:checkin_feedback   ( comment, video_link, is_complete, viewed_at )
    `)
    .in('client_id', clientIds)
    .eq('type', 'weekly')
    .gte('created_at', monday.toISOString())
    .lte('created_at', sunday.toISOString())
    .order('created_at', { ascending: false })

  // Most recent check-in per client (array is already sorted desc)
  const checkinByClient = new Map<string, NonNullable<typeof checkins>[number]>()
  for (const c of (checkins ?? [])) {
    if (!checkinByClient.has(c.client_id)) checkinByClient.set(c.client_id, c)
  }

  // 3. Build ClientRow[]
  const rows: ClientRow[] = clients.map(cl => {
    const raw = checkinByClient.get(cl.id) ?? null
    const template = raw
      ? (Array.isArray(raw.template) ? raw.template[0] : raw.template) ?? null
      : null
    const feedbackRaw = raw
      ? (Array.isArray(raw.feedback) ? raw.feedback[0] : raw.feedback) ?? null
      : null

    return {
      id:    cl.id,
      name:  cl.name,
      email: cl.email,
      checkin: raw ? {
        id:         raw.id,
        created_at: raw.created_at,
        answers:    raw.answers as Record<string, string | number | boolean>,
        template:   template as ClientRow['checkin'] extends null ? never : NonNullable<ClientRow['checkin']>['template'],
      } : null,
      feedback: feedbackRaw ? {
        comment:     feedbackRaw.comment     ?? null,
        video_link:  feedbackRaw.video_link  ?? null,
        is_complete: feedbackRaw.is_complete ?? false,
        viewed_at:   feedbackRaw.viewed_at   ?? null,
      } : null,
    }
  })

  return (
    <WeeklyOverviewView
      rows={rows}
      weekLabel={label}
      weekOffset={weekOffset}
      isCurrentWeek={weekOffset === 0}
    />
  )
}
