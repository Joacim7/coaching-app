import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function WorkoutLogListPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: rel }, { data: logs }] = await Promise.all([
    supabase
      .from('coach_clients')
      .select('client_id, profile:profiles!client_id(full_name)')
      .eq('coach_id', user!.id)
      .eq('client_id', clientId)
      .single(),
    supabase
      .from('workout_logs')
      .select('id, session_title, date, sets_data')
      .eq('client_id', clientId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  if (!rel) notFound()

  const profile = Array.isArray(rel.profile) ? rel.profile[0] : rel.profile
  const allLogs = logs ?? []

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">

      {/* Back */}
      <Link
        href={`/clients/${clientId}/training`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        {profile?.full_name ?? 'Klient'} — Trening
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Treningslogg</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {allLogs.length} {allLogs.length === 1 ? 'treningsøkt' : 'treningsøkter'} logget
        </p>
      </div>

      {/* List */}
      {allLogs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-400">Ingen treningsøkter logget ennå</p>
        </div>
      ) : (
        <div className="space-y-2">
          {allLogs.map(log => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const setsData: any[] = Array.isArray(log.sets_data) ? log.sets_data : []
            const isCardioLog = setsData[0]?.type === 'cardio'
            const strengthSets = isCardioLog ? [] : setsData
            const totalSets = strengthSets.length
            const totalKg = strengthSets.reduce((sum: number, s: { weight_kg?: string; reps?: string }) =>
              sum + (parseFloat(s.weight_kg ?? '0') || 0) * (parseInt(s.reps ?? '0') || 0), 0)

            return (
              <Link
                key={log.id}
                href={`/clients/${clientId}/workout-log/${log.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3.5 rounded-xl border border-gray-100 bg-white hover:border-[#6ecfb0] hover:bg-[#f9fefb] transition-colors group"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-gray-800 truncate">
                    {log.session_title ?? 'Treningsøkt'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 capitalize">{fmtDate(log.date)}</p>
                </div>
                <div className="flex items-center gap-5 shrink-0">
                  {isCardioLog ? (
                    <>
                      {setsData[0]?.duration_min != null && (
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-700">{setsData[0].duration_min} min</p>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide">varighet</p>
                        </div>
                      )}
                      {setsData[0]?.distance_km != null && (
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-700">{setsData[0].distance_km} km</p>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide">distanse</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-700">{totalSets}</p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">sett</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-700">
                          {Math.round(totalKg).toLocaleString('nb-NO')} kg
                        </p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">volum</p>
                      </div>
                    </>
                  )}
                  <span className="text-gray-300 group-hover:text-[#6ecfb0] transition-colors text-lg leading-none">›</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
