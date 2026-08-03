export interface DailyMetricRow {
  date: string
  weight_kg:    number | null
  sleep_hours:  number | null
  steps:        number | null
  energy_level: number | null
  mood:         number | null
}

// Daily check-ins are where clients log weight, sleep, steps, energy.
// Fetches history and collapses it to one row per calendar day (latest
// check-in of that day wins) so every consumer works off the same series.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getDailyMetrics(supabase: any, clientId: string): Promise<DailyMetricRow[]> {
  const { data: rows } = await supabase
    .from('checkins')
    .select('created_at, weight_kg, sleep_hours, steps, energy_level, mood')
    .eq('client_id', clientId)
    .eq('type', 'daily')
    .order('created_at', { ascending: true })
    .limit(500)

  const byDay = new Map<string, DailyMetricRow>()

  for (const r of (rows ?? [])) {
    const day = r.created_at.slice(0, 10)
    byDay.set(day, {
      date:         day,
      weight_kg:    r.weight_kg    ?? null,
      sleep_hours:  r.sleep_hours  ?? null,
      steps:        r.steps        ?? null,
      energy_level: r.energy_level ?? null,
      mood:         r.mood         ?? null,
    })
  }

  return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date))
}

const DAY = 86_400_000

// `date` fields are UTC calendar-day strings (YYYY-MM-DD, see getDailyMetrics
// above). Comparing those against a precise Date.now() millisecond timestamp
// makes the window's edge drift with the time of day the calculation runs —
// effectively behaving like a calendar-aligned window instead of a true
// rolling one. Deriving the cutoff as a same-format date string and comparing
// lexicographically keeps the boundary exact and identical everywhere.
function dateNDaysAgoStr(n: number): string {
  return new Date(Date.now() - n * DAY).toISOString().slice(0, 10)
}

// Bounds for a rolling N-day window ending today (inclusive), plus the
// preceding N-day window for period-over-period comparisons. Every consumer
// (Progresjon's "Uke" filter, Oversikt's "Nåværende") must derive its window
// from this so they always agree.
export function rollingWindowBounds(days: number) {
  return {
    start:     dateNDaysAgoStr(days - 1),
    prevStart: dateNDaysAgoStr(2 * days - 1),
    prevEnd:   dateNDaysAgoStr(days - 1),
  }
}

// Average weight over the trailing `days` days, using the same per-day-deduped
// series and rolling-window bounds as the Progresjon tab's "uke" filter.
export function averageRecentWeight(rows: DailyMetricRow[], days = 7): number | null {
  const { start } = rollingWindowBounds(days)
  const weights = rows
    .filter(r => r.date >= start && r.weight_kg != null)
    .map(r => r.weight_kg as number)

  if (!weights.length) return null
  return weights.reduce((sum, w) => sum + w, 0) / weights.length
}
