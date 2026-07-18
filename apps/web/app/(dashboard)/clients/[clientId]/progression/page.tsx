import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ProgressionView } from './progression-view'

export default async function ProgressionPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Verify coach–client relationship
  const { data: rel } = await supabase
    .from('coach_clients')
    .select('client_id')
    .eq('coach_id', user!.id)
    .eq('client_id', clientId)
    .single()

  if (!rel) notFound()

  // Daily check-ins are where clients log weight, sleep, steps, energy
  const { data: rows } = await supabase
    .from('checkins')
    .select('created_at, weight_kg, sleep_hours, steps, energy_level, mood')
    .eq('client_id', clientId)
    .eq('type', 'daily')
    .order('created_at', { ascending: true })
    .limit(500)

  // Normalise to date + nullable values (one entry per calendar day, keep latest if duplicates)
  const byDay = new Map<string, {
    date: string
    weight_kg:    number | null
    sleep_hours:  number | null
    steps:        number | null
    energy_level: number | null
    mood:         number | null
  }>()

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

  const data = Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date))

  return <ProgressionView data={data} />
}
