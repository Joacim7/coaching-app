import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { MessageSquare, ChevronLeft, Dumbbell, UtensilsCrossed, ClipboardList } from 'lucide-react'
import { ClientTabNav } from './client-tab-nav'
import { ClientSettingsPanel } from './client-settings-panel'
import type { ClientStatus } from '@coaching/types'

const STATUS_CONFIG: Record<ClientStatus, { label: string; pill: string; dot: string }> = {
  active:     { label: 'Aktiv',             pill: 'bg-green-50 text-green-700',   dot: 'bg-green-500' },
  inactive:   { label: 'Inaktiv',           pill: 'bg-gray-100 text-gray-500',    dot: 'bg-gray-400' },
  new:        { label: 'Ny klient',         pill: 'bg-[#ebf5ef] text-[#1a5c3a]',     dot: 'bg-[#2d8653]' },
  onboarding: { label: 'Venter onboarding', pill: 'bg-yellow-50 text-yellow-700', dot: 'bg-yellow-500' },
  course:     { label: 'På kurs',           pill: 'bg-[#ebf5ef] text-[#1a5c3a]', dot: 'bg-[#2d8653]' },
  followup:   { label: 'Oppfølging',        pill: 'bg-orange-50 text-orange-700', dot: 'bg-orange-400' },
  app_access: { label: 'App tilgang',       pill: 'bg-blue-50 text-blue-700',     dot: 'bg-blue-500' },
}

const GRADIENTS = [
  'from-[#6ecfb0] to-[#2d8653]', 'from-violet-400 to-violet-600',
  'from-green-400 to-green-600', 'from-orange-400 to-orange-600',
  'from-pink-400 to-pink-600', 'from-teal-400 to-teal-600',
  'from-rose-400 to-rose-600', 'from-amber-400 to-amber-600',
]

function avatarGradient(name: string) {
  return GRADIENTS[(name.charCodeAt(0) ?? 0) % GRADIENTS.length]
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

function relDate(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return 'I dag'
  if (days === 1) return 'I går'
  if (days < 7) return `${days}d siden`
  return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
}

export default async function ClientDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: rel } = await supabase
    .from('coach_clients')
    .select('*, profile:profiles!client_id(id, full_name, avatar_url, created_at)')
    .eq('coach_id', user!.id)
    .eq('client_id', clientId)
    .single()

  if (!rel) notFound()

  const profile = Array.isArray(rel.profile) ? rel.profile[0] : rel.profile
  const name = profile?.full_name ?? 'Klient'
  const status = (rel.status ?? 'active') as ClientStatus
  const sc = STATUS_CONFIG[status]

  const [checkinRes, planRes, mealRes, goalRes] = await Promise.all([
    supabase
      .from('checkins')
      .select('created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('training_plans')
      .select('title, sessions:training_sessions(title, day_of_week)')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('meal_plans')
      .select('calories_target, title')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('client_goals')
      .select('target_weight_kg, description, target_date')
      .eq('client_id', clientId)
      .eq('coach_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const lastCheckinAt = checkinRes.data?.[0]?.created_at ?? null
  const plan = planRes.data?.[0] ?? null
  const meal = mealRes.data?.[0] ?? null
  const goal = goalRes.data ?? null

  // Pick the session closest to today (Mon=1…Sun=7)
  const todayDow = new Date().getDay() || 7
  const sessions: { title: string; day_of_week: number }[] = plan?.sessions ?? []
  const nextSession = sessions
    .slice()
    .sort((a, b) => (a.day_of_week - todayDow + 7) % 7 - (b.day_of_week - todayDow + 7) % 7)[0]

  return (
    <div className="space-y-0">
      {/* Back link */}
      <Link
        href="/clients"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-4 group"
      >
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Alle klienter
      </Link>

      {/* Hero card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-1">
        <div className="flex items-start justify-between gap-4">
          {/* Left: avatar + info */}
          <div className="flex items-center gap-4 min-w-0">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${avatarGradient(name)} flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-sm`}>
              {initials(name)}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900 truncate">{name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${sc.pill}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                  {sc.label}
                </span>
                <span className="text-xs text-gray-400">
                  Klient siden {new Date(rel.created_at).toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' })}
                </span>
              </div>
              {goal ? (
                <p className="text-sm text-[#2d8653] mt-1.5 font-medium">
                  {goal.description
                    ? goal.description
                    : goal.target_weight_kg != null
                      ? `Målvekt: ${goal.target_weight_kg} kg`
                      : 'Mål satt'}
                </p>
              ) : (
                <p className="text-sm text-gray-400 mt-1.5 italic">Mål ikke satt ennå</p>
              )}
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button className="p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:text-[#2d8653] hover:border-[#cdeee3] transition-colors" title="Send melding">
              <MessageSquare className="w-4 h-4" />
            </button>
            <ClientSettingsPanel clientId={clientId} clientName={name} />
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          {/* CHECK-IN */}
          <div className="bg-[#ebf5ef] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#cdeee3] flex items-center justify-center">
                <ClipboardList className="w-3.5 h-3.5 text-[#2d8653]" />
              </div>
              <span className="text-[10px] font-bold text-[#6ecfb0] uppercase tracking-wider">Check-in</span>
            </div>
            {lastCheckinAt ? (
              <>
                <p className="text-sm font-bold text-[#1a5c3a]">{relDate(lastCheckinAt)}</p>
                <p className="text-xs text-[#2d8653] mt-0.5">Siste innsending</p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-[#6ecfb0]">Ingen ennå</p>
                <p className="text-xs text-[#6ecfb0] mt-0.5">Ikke registrert</p>
              </>
            )}
          </div>

          {/* TRENING */}
          <div className="bg-[#ebf5ef] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#cdeee3] flex items-center justify-center">
                <Dumbbell className="w-3.5 h-3.5 text-[#2d8653]" />
              </div>
              <span className="text-[10px] font-bold text-[#6ecfb0] uppercase tracking-wider">Trening</span>
            </div>
            {plan ? (
              <>
                <p className="text-sm font-bold text-[#1a5c3a] truncate">{nextSession?.title ?? 'Ingen økt'}</p>
                <p className="text-xs text-[#2d8653] mt-0.5 truncate">{plan.title}</p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-[#6ecfb0]">Ingen plan</p>
                <p className="text-xs text-[#6ecfb0] mt-0.5">Ikke tildelt</p>
              </>
            )}
          </div>

          {/* ERNÆRING */}
          <div className="bg-green-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center">
                <UtensilsCrossed className="w-3.5 h-3.5 text-green-600" />
              </div>
              <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Ernæring</span>
            </div>
            {meal?.calories_target ? (
              <>
                <p className="text-sm font-bold text-green-900">{meal.calories_target} kcal</p>
                <p className="text-xs text-green-500 mt-0.5">Daglig mål</p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-green-300">Ikke satt</p>
                <p className="text-xs text-green-400 mt-0.5">Kalorimål mangler</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <ClientTabNav clientId={clientId} />

      {/* Tab content */}
      <div className="bg-white rounded-b-2xl border border-t-0 border-gray-100 p-6">
        {children}
      </div>
    </div>
  )
}
