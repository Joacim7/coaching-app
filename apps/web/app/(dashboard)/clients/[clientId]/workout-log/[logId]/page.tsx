import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { DeleteWorkoutButton } from './delete-workout-button'
import { getTranslator, normalizeLocale, type TranslationKey } from '@/lib/i18n/translations'

// Mirrors the training editor's HEART_RATE_ZONE_LABEL_KEYS — the coach
// prescribes and the client logs the same 'Sone 1'..'Sone 5' values.
const HEART_RATE_ZONE_LABEL_KEYS: Record<string, TranslationKey> = {
  'Sone 1': 'trainingEditor.heartRateZone1',
  'Sone 2': 'trainingEditor.heartRateZone2',
  'Sone 3': 'trainingEditor.heartRateZone3',
  'Sone 4': 'trainingEditor.heartRateZone4',
  'Sone 5': 'trainingEditor.heartRateZone5',
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('nb-NO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function isCardio(setsData: any[]): boolean {
  return setsData?.[0]?.type === 'cardio'
}

function groupByExercise(sets: any[]): { name: string; sets: any[] }[] {
  const map = new Map<string, any[]>()
  for (const s of sets) {
    const name = s.exercise_name ?? 'Ukjent'
    if (!map.has(name)) map.set(name, [])
    map.get(name)!.push(s)
  }
  return Array.from(map.entries()).map(([name, sets]) => ({ name, sets }))
}

// Build a lookup: exerciseName → setNumber → { weight_kg, reps }
function buildPrevMap(sets: any[]): Map<string, Map<number, { weight_kg: number; reps: number }>> {
  const outer = new Map<string, Map<number, { weight_kg: number; reps: number }>>()
  for (const s of sets) {
    const name = s.exercise_name ?? 'Ukjent'
    if (!outer.has(name)) outer.set(name, new Map())
    outer.get(name)!.set(s.set_number, {
      weight_kg: parseFloat(s.weight_kg) || 0,
      reps:      parseInt(s.reps)        || 0,
    })
  }
  return outer
}

function Delta({ val }: { val: number }) {
  if (val === 0) return null
  const positive = val > 0
  return (
    <span className={`ml-1 text-[10px] font-bold px-1 py-0.5 rounded ${
      positive ? 'text-[#1a5c3a] bg-[#cdeee3]' : 'text-red-700 bg-red-100'
    }`}>
      {positive ? '+' : ''}{val}
    </span>
  )
}

export default async function WorkoutLogDetailPage({
  params,
}: {
  params: Promise<{ clientId: string; logId: string }>
}) {
  const { clientId, logId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: log }, { data: rel }] = await Promise.all([
    supabase
      .from('workout_logs')
      .select('*, profile:profiles!client_id(full_name)')
      .eq('id', logId)
      .eq('client_id', clientId)
      .single(),
    supabase
      .from('coach_clients')
      .select('client_id')
      .eq('coach_id', user!.id)
      .eq('client_id', clientId)
      .single(),
  ])

  if (!log || !rel) notFound()

  const { data: coachProfile } = await supabase
    .from('profiles')
    .select('language')
    .eq('id', user!.id)
    .single()
  const t = getTranslator(normalizeLocale(coachProfile?.language))

  const clientProfile = Array.isArray(log.profile) ? log.profile[0] : log.profile
  const setsData: any[] = Array.isArray(log.sets_data) ? log.sets_data : []
  const cardio = isCardio(setsData)
  const cardioData = cardio ? setsData[0] : null
  const groups = cardio ? [] : groupByExercise(setsData)
  const totalSets = cardio ? 0 : setsData.length
  const totalKg = groups.reduce((sum, g) =>
    sum + g.sets.reduce((s2, s) =>
      s2 + (parseFloat(s.weight_kg) || 0) * (parseInt(s.reps) || 0), 0), 0)

  // Fetch the previous instance of the same session (the one logged right before this one)
  let prevMap: ReturnType<typeof buildPrevMap> = new Map()
  let prevDate: string | null = null

  if (!cardio && log.session_title) {
    const { data: prevLog } = await supabase
      .from('workout_logs')
      .select('sets_data, date')
      .eq('client_id', clientId)
      .eq('session_title', log.session_title)
      .neq('id', logId)
      .lt('created_at', log.created_at)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (prevLog?.sets_data && Array.isArray(prevLog.sets_data)) {
      prevMap  = buildPrevMap(prevLog.sets_data)
      prevDate = prevLog.date
    }
  }

  const hasPrev = prevMap.size > 0

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">

      {/* Back + delete */}
      <div className="flex items-center justify-between">
        <Link
          href={`/clients/${clientId}/training`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {clientProfile?.full_name ?? t('dashboard.clientFallback')} {t('clientDetail.workoutLog.backSuffix')}
        </Link>
        <DeleteWorkoutButton clientId={clientId} logId={logId} />
      </div>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">{cardio ? '🏃' : '🏋️'}</span>
          <h1 className="text-2xl font-bold text-gray-900">
            {log.session_title ?? t('clientDetail.training.workoutSession')}
          </h1>
        </div>
        <p className="text-sm text-gray-500 capitalize">{fmtDate(log.date)}</p>
        {hasPrev && prevDate && (
          <p className="text-xs text-gray-400 mt-1">
            {t('clientDetail.workoutLog.comparedWith')}{' '}
            {new Date(prevDate).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        )}
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        {cardio ? (
          <>
            {cardioData?.activity_type && (
              <div className="rounded-xl bg-[#ebf5ef] px-4 py-3">
                <p className="text-lg font-bold text-[#1a5c3a]">{cardioData.activity_type}</p>
                <p className="text-xs text-[#2d8653] font-semibold mt-0.5">{t('clientDetail.workoutLog.type')}</p>
              </div>
            )}
            {cardioData?.duration_min != null && (
              <div className="rounded-xl bg-[#ebf5ef] px-4 py-3">
                <p className="text-lg font-bold text-[#1a5c3a]">{cardioData.duration_min} min</p>
                <p className="text-xs text-[#2d8653] font-semibold mt-0.5">{t('clientDetail.workoutLog.durationLabel')}</p>
              </div>
            )}
            {cardioData?.distance_km != null && (
              <div className="rounded-xl bg-[#ebf5ef] px-4 py-3">
                <p className="text-lg font-bold text-[#1a5c3a]">{cardioData.distance_km} km</p>
                <p className="text-xs text-[#2d8653] font-semibold mt-0.5">{t('clientDetail.workoutLog.distanceLabel')}</p>
              </div>
            )}
            {cardioData?.heart_rate_zone ? (
              <div className="rounded-xl bg-[#ebf5ef] px-4 py-3">
                <p className="text-lg font-bold text-[#1a5c3a]">
                  {t(HEART_RATE_ZONE_LABEL_KEYS[cardioData.heart_rate_zone] ?? 'clientDetail.workoutLog.heartRateZone')}
                </p>
                <p className="text-xs text-[#2d8653] font-semibold mt-0.5">{t('clientDetail.workoutLog.heartRateZone')}</p>
              </div>
            ) : cardioData?.avg_hr_bpm != null && (
              <div className="rounded-xl bg-[#ebf5ef] px-4 py-3">
                <p className="text-lg font-bold text-[#1a5c3a]">{cardioData.avg_hr_bpm} bpm</p>
                <p className="text-xs text-[#2d8653] font-semibold mt-0.5">{t('clientDetail.workoutLog.avgHr')}</p>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="rounded-xl bg-[#ebf5ef] px-4 py-3">
              <p className="text-lg font-bold text-[#1a5c3a]">{totalSets}</p>
              <p className="text-xs text-[#2d8653] font-semibold mt-0.5">{t('clientDetail.workoutLog.totalSets')}</p>
            </div>
            {totalKg > 0 && (
              <div className="rounded-xl bg-[#ebf5ef] px-4 py-3">
                <p className="text-lg font-bold text-[#1a5c3a]">
                  {Math.round(totalKg).toLocaleString('nb-NO')} kg
                </p>
                <p className="text-xs text-[#2d8653] font-semibold mt-0.5">{t('clientDetail.workoutLog.volumeLabel')}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Exercise breakdown (strength) */}
      {!cardio && groups.length > 0 && (
        <div className="space-y-3">
          {groups.map(group => {
            // A cardio sub-section exercise inside an otherwise-strength
            // session (see mobile's Exercise.cardioConfig) — its "sets" is
            // really just the one cardio result, not a real set list.
            const cardioEntry = group.sets[0]?.type === 'cardio' ? group.sets[0] : null
            if (cardioEntry) {
              return (
                <div key={group.name} className="rounded-xl border border-gray-100 bg-white overflow-hidden px-4 py-3">
                  <p className="font-semibold text-gray-900 mb-2">{group.name}</p>
                  <div className="flex flex-wrap gap-4">
                    {cardioEntry.duration_min != null && (
                      <div>
                        <p className="text-sm font-bold text-[#1a5c3a]">{cardioEntry.duration_min} min</p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">{t('clientDetail.workoutLog.durationLabel')}</p>
                      </div>
                    )}
                    {cardioEntry.distance_km != null && (
                      <div>
                        <p className="text-sm font-bold text-[#1a5c3a]">{cardioEntry.distance_km} km</p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">{t('clientDetail.workoutLog.distanceLabel')}</p>
                      </div>
                    )}
                    {cardioEntry.heart_rate_zone && (
                      <div>
                        <p className="text-sm font-bold text-[#1a5c3a]">
                          {t(HEART_RATE_ZONE_LABEL_KEYS[cardioEntry.heart_rate_zone] ?? 'clientDetail.workoutLog.heartRateZone')}
                        </p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">{t('clientDetail.workoutLog.heartRateZone')}</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            }

            const groupVol = group.sets.reduce((s, r) =>
              s + (parseFloat(r.weight_kg) || 0) * (parseInt(r.reps) || 0), 0)
            const prevExercise = prevMap.get(group.name)

            return (
              <div key={group.name} className="rounded-xl border border-gray-100 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                  <p className="font-semibold text-gray-900">{group.name}</p>
                  {groupVol > 0 && (
                    <p className="text-xs text-gray-400">
                      {Math.round(groupVol).toLocaleString('nb-NO')} kg {t('clientDetail.workoutLog.volume')}
                    </p>
                  )}
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                      <th className="px-4 py-2 text-left w-14">{t('clientDetail.workoutLog.setCol')}</th>
                      <th className="px-4 py-2 text-right">{t('clientDetail.workoutLog.weightCol')}</th>
                      <th className="px-4 py-2 text-right">{t('clientDetail.workoutLog.repsCol')}</th>
                      <th className="px-4 py-2 text-right">{t('clientDetail.workoutLog.volumeCol')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {group.sets
                      .sort((a, b) => a.set_number - b.set_number)
                      .map((s, i) => {
                        const curWeight = parseFloat(s.weight_kg) || 0
                        const curReps   = parseInt(s.reps)        || 0
                        const vol       = curWeight * curReps

                        const prev       = prevExercise?.get(s.set_number)
                        const deltaWeight = prev != null ? curWeight - prev.weight_kg : 0
                        const deltaReps   = prev != null ? curReps   - prev.reps      : 0

                        return (
                          <tr key={i} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-2.5">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#ebf5ef] text-[#1a5c3a] text-xs font-bold">
                                {s.set_number}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-gray-800">
                              {s.weight_kg || '–'}
                              <Delta val={deltaWeight} />
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-gray-800">
                              {s.reps || '–'}
                              <Delta val={deltaReps} />
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-gray-400">
                              {vol > 0 ? `${Math.round(vol)} kg` : '–'}
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}

      {/* Comment */}
      {log.comment && (
        <div className="rounded-xl border-l-4 border-[#2d8653] bg-[#ebf5ef] px-4 py-3">
          <p className="text-[11px] font-bold text-[#2d8653] uppercase tracking-wide mb-1">{t('clientDetail.workoutLog.comment')}</p>
          <p className="text-sm text-[#1a5c3a]">{log.comment}</p>
        </div>
      )}

    </div>
  )
}
