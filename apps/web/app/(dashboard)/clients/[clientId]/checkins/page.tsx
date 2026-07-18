import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { CheckinsView } from './checkins-view'
import type { CheckinRow } from '../recent-checkins'

export default async function ClientCheckinsPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: rel } = await supabase
    .from('coach_clients')
    .select('client_id, profile:profiles!client_id(full_name)')
    .eq('coach_id', user!.id)
    .eq('client_id', clientId)
    .single()

  if (!rel) notFound()

  const profile = Array.isArray(rel.profile) ? rel.profile[0] : rel.profile

  const { data: raw } = await supabase
    .from('checkins')
    .select(`
      id, created_at, type, mood, notes, answers,
      weight_kg, sleep_hours, energy_level, steps,
      template:checkin_templates ( name, questions ),
      feedback:checkin_feedback ( comment, video_link )
    `)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  const checkins: CheckinRow[] = (raw ?? []).map(c => ({
    ...c,
    template: Array.isArray(c.template) ? (c.template[0] ?? null) : (c.template ?? null),
    feedback: Array.isArray(c.feedback) ? (c.feedback[0] ?? null) : (c.feedback ?? null),
  }))

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/clients/${clientId}`} className="text-gray-400 hover:text-gray-600 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <p className="text-sm text-gray-500">{(profile as any)?.full_name}</p>
          <h1 className="text-xl font-bold text-gray-900">Check-ins</h1>
        </div>
      </div>

      <CheckinsView checkins={checkins} clientId={clientId} />
    </div>
  )
}
