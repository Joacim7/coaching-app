import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  AlertCircle,
  Clock,
  TrendingUp,
  CalendarDays,
  Dumbbell,
  UtensilsCrossed,
} from 'lucide-react'
import type { ClientPhase, ClientStatus, CheckinTemplate } from '@coaching/types'
import { PhaseTimeline } from './phase-timeline'
import { type CheckinRow } from './recent-checkins'
import { GoalPanel } from './goal-panel'
import { OnboardingPanel } from './onboarding-panel'

const STATUS_LABEL: Record<ClientStatus, string> = {
  active:     'Aktiv',
  inactive:   'Inaktiv',
  new:        'Ny klient',
  onboarding: 'Venter onboarding',
  course:     'På kurs',
  followup:   'Oppfølging',
  app_access: 'App tilgang',
}

function longDate(iso: string) {
  return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function ClientOverviewPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: rel } = await supabase
    .from('coach_clients')
    .select('status, created_at, profile:profiles!client_id(full_name, created_at)')
    .eq('coach_id', user!.id)
    .eq('client_id', clientId)
    .single()

  if (!rel) notFound()

  const profile = Array.isArray(rel.profile) ? rel.profile[0] : rel.profile
  const status = (rel.status ?? 'active') as ClientStatus

  const [checkinRes, planRes, mealRes, phasesRes, workoutRes, goalRes, allPlansRes, allMealsRes, onboardingSubRes, onboardingTplRes] = await Promise.all([
    supabase
      .from('checkins')
      .select(`
        id, created_at, mood, type, notes, answers,
        template:checkin_templates ( name, questions ),
        feedback:checkin_feedback ( comment, video_link )
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('training_plans')
      .select('id, title')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .limit(1),
    supabase
      .from('meal_plans')
      .select('id, title, calories_target, protein_g, carbs_g, fat_g')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .limit(1),
    supabase
      .from('client_phases')
      .select('*')
      .eq('client_id', clientId)
      .eq('coach_id', user!.id)
      .order('start_date', { ascending: true }),
    supabase
      .from('workout_logs')
      .select('id, date, session_title, sets_data')
      .eq('client_id', clientId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('client_goals')
      .select('id, target_weight_kg, description, start_date, target_date')
      .eq('client_id', clientId)
      .eq('coach_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('training_plans')
      .select('id, title')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false }),
    supabase
      .from('meal_plans')
      .select('id, title')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false }),
    supabase
      .from('onboarding_submissions')
      .select('submitted_at, answers, template:checkin_templates(name, questions)')
      .eq('client_id', clientId)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('checkin_templates')
      .select('name, questions')
      .eq('coach_id', user!.id)
      .eq('type', 'onboarding')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  // Normalise Supabase join shapes (single-row joins can come back as array or object)
  const checkins: CheckinRow[] = (checkinRes.data ?? []).map(c => ({
    ...c,
    template: Array.isArray(c.template) ? (c.template[0] ?? null) : (c.template ?? null),
    feedback: Array.isArray(c.feedback) ? (c.feedback[0] ?? null) : (c.feedback ?? null),
  }))
  const plan        = planRes.data?.[0] ?? null
  const meal        = mealRes.data?.[0] ?? null
  const phases      = (phasesRes.data ?? []) as ClientPhase[]
  const workoutLogs = workoutRes.data ?? []
  const goal        = goalRes.data ?? null
  const allPlans    = (allPlansRes.data ?? []) as { id: string; title: string }[]
  const allMeals    = (allMealsRes.data ?? []) as { id: string; title: string }[]

  const onboardingSub  = onboardingSubRes.data ?? null
  const onboardingSubTpl = onboardingSub
    ? (Array.isArray(onboardingSub.template) ? onboardingSub.template[0] : onboardingSub.template)
    : null
  const onboardingTpl  = onboardingTplRes.data as { name: string; questions: CheckinTemplate['questions'] } | null
  const onboardingTemplateName = onboardingSubTpl?.name ?? onboardingTpl?.name ?? null
  const onboardingQuestions    = onboardingSubTpl?.questions ?? onboardingTpl?.questions ?? []
  const onboardingSubmission   = onboardingSub
    ? { submitted_at: onboardingSub.submitted_at, answers: onboardingSub.answers as Record<string, unknown> }
    : null

  // Unified activity feed: workout logs + checkins merged and sorted by date desc
  type FeedItem =
    | { kind: 'workout'; id: string; sortKey: string; title: string | null; isCardio: boolean; setsCount: number; totalKg: number; cardioData: any }
    | { kind: 'checkin'; id: string; sortKey: string; type: string; mood: number | null }

  const workoutItems: FeedItem[] = workoutLogs.map(w => {
    const sets: any[] = Array.isArray(w.sets_data) ? w.sets_data : []
    const isCardio = sets[0]?.type === 'cardio'
    return {
      kind: 'workout',
      id: w.id,
      sortKey: w.date,
      title: w.session_title,
      isCardio,
      setsCount: isCardio ? 0 : sets.length,
      totalKg: isCardio ? 0 : sets.reduce((s: number, r: any) => s + (parseFloat(r.weight_kg) || 0) * (parseInt(r.reps) || 0), 0),
      cardioData: isCardio ? sets[0] : null,
    }
  })

  const checkinItems: FeedItem[] = checkins.slice(0, 6).map(c => ({
    kind: 'checkin',
    id: c.id,
    sortKey: c.created_at,
    type: c.type,
    mood: c.mood,
  }))

  const activityFeed = [...workoutItems, ...checkinItems]
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
    .slice(0, 8)

  const lastCheckin = checkins[0] ?? null
  const daysSinceLast = lastCheckin
    ? Math.floor((Date.now() - new Date(lastCheckin.created_at).getTime()) / 86_400_000)
    : null

  const missingCheckin = daysSinceLast === null || daysSinceLast > 7

  return (
    <div className="space-y-5">

      {/* ── Alerts ─────────────────────────────────────────── */}
      {(missingCheckin || status === 'onboarding' || status === 'new') && (
        <div className="space-y-2.5">
          {missingCheckin && (
            <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl p-4">
              <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-orange-800">Manglende check-in</p>
                <p className="text-xs text-orange-600 mt-0.5">
                  {lastCheckin
                    ? `Ingen check-in på ${daysSinceLast} dager. Siste: ${
                        new Date(lastCheckin.created_at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })
                      }.`
                    : 'Klienten har aldri sendt inn en check-in.'}
                  {' '}
                  <Link href={`/clients/${clientId}/checkins`} className="underline font-medium">Se check-ins</Link>
                </p>
              </div>
            </div>
          )}
          {(status === 'new' || status === 'onboarding') && (
            <div className="flex items-start gap-3 bg-[#ebf5ef] border border-[#cdeee3] rounded-xl p-4">
              <Clock className="w-4 h-4 text-[#2d8653] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-[#1a5c3a]">
                  {status === 'new' ? 'Ny klient' : 'Onboarding pågår'}
                </p>
                <p className="text-xs text-[#2d8653] mt-0.5">
                  {status === 'new'
                    ? 'Klienten er registrert men har ikke startet ennå. Sett opp trenings- og kostholdsplan.'
                    : 'Klienten er i onboarding-fasen. Følg opp og fullfør oppsett.'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Progresjonsoversikt ─────────────────────────────── */}
      <div className="border border-gray-100 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
            <TrendingUp className="w-4 h-4 text-[#2d8653]" />
            Progresjonsoversikt
          </h3>
          <span className="text-xs text-gray-400">Basert på check-ins</span>
        </div>
        <div className="grid grid-cols-3 divide-x divide-gray-100">
          <div className="p-5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Startpunkt</p>
            <p className="text-3xl font-bold text-gray-300">—</p>
            <p className="text-xs text-gray-400 mt-1">
              {longDate(rel.created_at)}
            </p>
          </div>
          <div className="p-5 text-center relative bg-[#ebf5ef]/50">
            <span className="absolute top-3 left-1/2 -translate-x-1/2 bg-[#2d8653] text-white text-[9px] font-bold px-2 py-0.5 rounded-full">NÅ</span>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#6ecfb0] mb-2 mt-2">Nåværende</p>
            <p className="text-3xl font-bold text-[#6ecfb0]">—</p>
            <p className="text-xs text-[#6ecfb0] mt-1">Ingen data ennå</p>
          </div>
          <div className="p-5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-green-400 mb-2">Mål</p>
            {goal?.target_weight_kg != null ? (
              <>
                <p className="text-3xl font-bold text-green-700">{goal.target_weight_kg}</p>
                <p className="text-xs text-green-500 mt-1">kg målvekt</p>
                {goal.description && (
                  <p className="text-xs text-green-400 mt-1.5 line-clamp-2 leading-relaxed">{goal.description}</p>
                )}
              </>
            ) : goal?.description ? (
              <>
                <p className="text-2xl font-bold text-green-600 mt-1">🎯</p>
                <p className="text-xs text-green-600 mt-1 font-medium line-clamp-2 leading-relaxed">{goal.description}</p>
              </>
            ) : (
              <>
                <p className="text-3xl font-bold text-green-300">—</p>
                <p className="text-xs text-green-400 mt-1">Ikke satt</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Klientfaser ────────────────────────────────────── */}
      <PhaseTimeline
        clientId={clientId}
        clientSince={rel.created_at.slice(0, 10)}
        initialPhases={phases}
        availableTrainingPlans={allPlans}
        availableMealPlans={allMeals}
      />

      {/* ── Bottom two columns ──────────────────────────────── */}
      <div className="grid grid-cols-5 gap-4">

        {/* Left: activity feed (3/5) */}
        <div className="col-span-3 border border-gray-100 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-gray-400" />
              Siste aktivitet
            </h3>
          </div>
          <div className="p-4 space-y-1">
            {activityFeed.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-400">Ingen aktivitet registrert</p>
              </div>
            ) : activityFeed.map(item => {
              if (item.kind === 'workout') {
                const label = item.isCardio
                  ? [item.cardioData?.activity_type, item.cardioData?.duration_min && `${item.cardioData.duration_min} min`, item.cardioData?.distance_km && `${item.cardioData.distance_km} km`].filter(Boolean).join(' · ')
                  : [item.setsCount > 0 && `${item.setsCount} sett`, item.totalKg > 0 && `${Math.round(item.totalKg).toLocaleString('nb-NO')} kg`].filter(Boolean).join(' · ')
                return (
                  <div key={item.id} className="flex items-center gap-3 px-1 py-2.5 rounded-xl hover:bg-gray-50 transition-colors group">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm ${item.isCardio ? 'bg-blue-50' : 'bg-[#cdeee3]'}`}>
                      {item.isCardio ? '🏃' : '🏋️'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.title ?? 'Treningsøkt'}
                      </p>
                      {label && <p className="text-xs text-gray-400 mt-0.5">{label}</p>}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-gray-400">
                        {new Date(item.sortKey).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}
                      </span>
                      <Link
                        href={`/clients/${clientId}/workout-log/${item.id}`}
                        className="text-xs font-medium text-[#2d8653] hover:text-[#1a5c3a] hover:underline"
                      >
                        Se
                      </Link>
                    </div>
                  </div>
                )
              }

              // checkin
              const MOOD_EMOJI = ['😢', '😞', '😐', '🙂', '😄']
              return (
                <div key={item.id} className="flex items-center gap-3 px-1 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-[#cdeee3] flex items-center justify-center flex-shrink-0 text-sm">
                    📋
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {item.type === 'daily' ? 'Daglig check-in' : 'Ukentlig check-in'}
                      {item.mood != null ? ` · ${MOOD_EMOJI[item.mood - 1]}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-gray-400">
                      {new Date(item.sortKey).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}
                    </span>
                    <Link
                      href={`/clients/${clientId}/checkins`}
                      className="text-xs font-medium text-[#2d8653] hover:text-[#1a5c3a] hover:underline"
                    >
                      Se
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: info panels (2/5) */}
        <div className="col-span-2 space-y-4">

          {/* Klientinfo */}
          <div className="border border-gray-100 rounded-2xl overflow-hidden">
            <div className="px-4 py-3.5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">Klientinfo</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Status</span>
                <span className="text-xs font-semibold text-gray-900">{STATUS_LABEL[status]}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Klient siden</span>
                <span className="text-xs font-semibold text-gray-900">
                  {new Date(rel.created_at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Check-ins</span>
                <span className="text-xs font-semibold text-gray-900">{checkins.length}+</span>
              </div>
            </div>
          </div>

          {/* Aktive planer */}
          <div className="border border-gray-100 rounded-2xl overflow-hidden">
            <div className="px-4 py-3.5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">Aktive planer</h3>
            </div>
            <div className="p-4 space-y-2.5">
              {/* Training plan */}
              <Link
                href={`/clients/${clientId}/training`}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#ebf5ef] transition-colors group"
              >
                <div className="w-7 h-7 rounded-lg bg-[#cdeee3] flex items-center justify-center flex-shrink-0">
                  <Dumbbell className="w-3.5 h-3.5 text-[#2d8653]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900 truncate group-hover:text-[#1a5c3a] transition-colors">
                    {plan?.title ?? 'Ingen treningsplan'}
                  </p>
                  <p className="text-[10px] text-gray-400">{plan ? 'Aktiv' : 'Ikke tildelt'}</p>
                </div>
              </Link>

              {/* Meal plan */}
              <Link
                href={`/clients/${clientId}/nutrition`}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-green-50 transition-colors group"
              >
                <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                  <UtensilsCrossed className="w-3.5 h-3.5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900 truncate group-hover:text-green-700 transition-colors">
                    {meal?.title ?? 'Ingen kostholdsplan'}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {meal?.calories_target ? `${meal.calories_target} kcal/dag` : 'Ikke tildelt'}
                  </p>
                </div>
              </Link>
            </div>
          </div>

          {/* Onboarding */}
          <OnboardingPanel
            clientId={clientId}
            clientName={profile?.full_name ?? 'Klient'}
            templateName={onboardingTemplateName}
            templateQuestions={onboardingQuestions}
            submission={onboardingSubmission}
          />

          {/* Mål */}
          <GoalPanel
            clientId={clientId}
            coachId={user!.id}
            initialGoal={goal as any}
          />
        </div>
      </div>
    </div>
  )
}
