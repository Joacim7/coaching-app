import { createClient } from '@/lib/supabase/server'
import { WeeklyOverviewView, type ClientRow } from './weekly-view'
import { getTranslator, normalizeLocale, type TranslationKey } from '@/lib/i18n/translations'

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

function weekLabel(
  monday: Date,
  sunday: Date,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
) {
  const md = monday.getUTCDate(), mm = t(`weeklyOverview.monthShort.${monday.getUTCMonth() + 1}` as TranslationKey)
  const sd = sunday.getUTCDate(), sm = t(`weeklyOverview.monthShort.${sunday.getUTCMonth() + 1}` as TranslationKey)
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('language')
    .eq('id', user!.id)
    .single()
  const t = getTranslator(normalizeLocale(profile?.language))

  const { monday, sunday } = getWeekBounds(weekOffset)
  const label = weekLabel(monday, sunday, t)

  // 1. All active clients for this coach (with email for reminders)
  const { data: clientLinks } = await supabase
    .from('coach_clients')
    .select('client_id, profile:profiles!client_id(full_name, email)')
    .eq('coach_id', user!.id)
    .neq('status', 'inactive')

  const clients = (clientLinks ?? []).map(l => {
    const p = Array.isArray(l.profile) ? l.profile[0] : l.profile
    return { id: l.client_id, name: p?.full_name ?? t('common.unknown'), email: p?.email ?? null }
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

  // A check-in submitted just before the Mon–Sun boundary (e.g. Sunday
  // night) falls into last week's bucket and would otherwise vanish from
  // the coach's view the moment the new week starts, even though nobody's
  // looked at it yet. On the current week, backfill any client who has no
  // submission THIS week with their most recent still-unread one from
  // before — so it keeps surfacing until a coach actually opens it,
  // regardless of which week it happened to land in.
  if (weekOffset === 0) {
    const missingIds = clientIds.filter(id => !checkinByClient.has(id))
    if (missingIds.length > 0) {
      const { data: carryOver } = await supabase
        .from('checkins')
        .select(`
          id, client_id, created_at, answers,
          template:checkin_templates ( name, questions ),
          feedback:checkin_feedback   ( comment, video_link, is_complete, viewed_at )
        `)
        .in('client_id', missingIds)
        .eq('type', 'weekly')
        .lt('created_at', monday.toISOString())
        .order('created_at', { ascending: false })

      for (const c of (carryOver ?? [])) {
        if (checkinByClient.has(c.client_id)) continue
        const fb = Array.isArray(c.feedback) ? c.feedback[0] : c.feedback
        // Already handled — a real gap, not a lost submission. Checking
        // is_complete too (not just viewed_at) matters: feedback saved from
        // the per-client check-ins tab before this carry-over feature
        // existed never stamped viewed_at, so a coach who already sent
        // feedback weeks ago could otherwise see that same client pop back
        // up as a fresh "Levert" here once their old submission ages past
        // the current week's Monday.
        if (fb?.viewed_at || fb?.is_complete) continue
        checkinByClient.set(c.client_id, c)
      }
    }
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
