import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Plus, Dumbbell, AlertTriangle, ChevronRight } from 'lucide-react'

function fmtDate(d: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }) {
  if (!d) return null
  return new Date(d).toLocaleDateString('nb-NO', opts)
}

export default async function TrainingPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>
  searchParams: Promise<{ showInactive?: string }>
}) {
  const { clientId } = await params
  const { showInactive } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: rel }, { data: plans }, { data: logs }] = await Promise.all([
    supabase
      .from('coach_clients')
      .select('client_id, profile:profiles!client_id(full_name)')
      .eq('coach_id', user!.id)
      .eq('client_id', clientId)
      .single(),
    supabase
      .from('training_plans')
      .select('id, title, is_active, start_date, created_at')
      .eq('client_id', clientId)
      .eq('coach_id', user!.id)
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('workout_logs')
      .select('id, session_title, date, sets_data')
      .eq('client_id', clientId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  if (!rel) notFound()

  const profile = Array.isArray(rel.profile) ? rel.profile[0] : rel.profile
  const allPlans = plans ?? []
  const activePlans = allPlans.filter(p => p.is_active)
  const visiblePlans = showInactive ? allPlans : activePlans
  const hasMultipleActive = activePlans.length > 1
  const hasInactive = allPlans.some(p => !p.is_active)

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trening</h1>
          <p className="text-sm text-gray-500 mt-0.5">{profile?.full_name}</p>
        </div>
        <Link
          href="/training-plans/new"
          className="flex items-center gap-1.5 h-9 px-4 text-sm font-bold rounded-lg bg-gradient-to-r from-[#1a5c3a] to-[#6ecfb0] text-white hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Ny plan
        </Link>
      </div>

      {/* ── Treningsplaner ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-800">Treningsplaner</h2>
          {hasInactive && (
            <Link
              href={showInactive ? `?` : `?showInactive=1`}
              className="text-xs text-[#1a5c3a] hover:underline"
            >
              {showInactive ? 'Skjul inaktive' : 'Vis inaktive planer'}
            </Link>
          )}
        </div>

        {hasMultipleActive && (
          <div className="mb-3 flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              {activePlans.length} aktive planer samtidig. Vurder å deaktivere noen.
            </span>
          </div>
        )}

        {visiblePlans.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center">
            <Dumbbell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Ingen treningsplaner ennå</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visiblePlans.map(plan => {
              const dateLabel = plan.start_date
                ? `Startet ${fmtDate(plan.start_date)}`
                : `Opprettet ${fmtDate(plan.created_at)}`
              return (
                <div
                  key={plan.id}
                  className="flex items-center justify-between gap-4 px-4 py-3.5 rounded-xl border border-gray-100 bg-white hover:border-[#6ecfb0] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {plan.is_active ? (
                      <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#ebf5ef] text-[#1a5c3a]">
                        Aktiv
                      </span>
                    ) : (
                      <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                        Inaktiv
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{plan.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{dateLabel}</p>
                    </div>
                  </div>
                  <Link
                    href={`/clients/${clientId}/training/${plan.id}`}
                    className="shrink-0 flex items-center gap-0.5 text-sm font-semibold text-[#1a5c3a] hover:text-[#2d8653] transition-colors"
                  >
                    Åpne plan
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Treningslogg ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-800">Treningslogg</h2>
          <button className="text-xs text-[#1a5c3a] hover:underline flex items-center gap-0.5">
            Se full oversikt
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {(logs ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-400">Ingen treningsøkter logget ennå</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(logs ?? []).map(log => {
              const setsData: any[] = Array.isArray(log.sets_data) ? log.sets_data : []
              const isCardioLog = setsData[0]?.type === 'cardio'
              const strengthSets = isCardioLog ? [] : setsData
              const totalSets = strengthSets.length
              const totalKg = strengthSets.reduce((sum: number, s: any) =>
                sum + (parseFloat(s.weight_kg) || 0) * (parseInt(s.reps) || 0), 0)
              const dateLabel = fmtDate(log.date, { weekday: 'short', day: 'numeric', month: 'short' })
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
                    <p className="text-xs text-gray-400 mt-0.5 capitalize">{dateLabel}</p>
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
      </section>

    </div>
  )
}
