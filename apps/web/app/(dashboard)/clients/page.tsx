import { createClient } from '@/lib/supabase/server'
import { UserPlus } from 'lucide-react'
import InviteClientDialog from './invite-client-dialog'
import { ClientList, type ClientRow } from './client-list'
import type { ClientStatus } from '@coaching/types'

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check org membership — if in an org, include all coaches' clients
  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user!.id)
    .single()

  let coachIds = [user!.id]
  const coachNameMap = new Map<string, string>() // coachId → full_name

  if (membership) {
    const { data: orgMembers } = await supabase
      .from('org_members')
      .select('user_id, profiles:profiles!user_id(full_name)')
      .eq('org_id', membership.org_id)

    coachIds = (orgMembers ?? []).map(m => m.user_id)
    for (const m of orgMembers ?? []) {
      if (m.user_id === user!.id) continue
      const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
      coachNameMap.set(m.user_id, (p as { full_name: string | null } | null)?.full_name ?? 'Ukjent coach')
    }
  }

  const { data: relations } = await supabase
    .from('coach_clients')
    .select('*, profile:profiles!client_id(id, full_name, avatar_url, created_at)')
    .in('coach_id', coachIds)
    .order('created_at', { ascending: false })

  const profileIds = (relations ?? []).flatMap(r => {
    const p = Array.isArray(r.profile) ? r.profile[0] : r.profile
    return p?.id ? [p.id as string] : []
  })

  const empty = ['']
  const ids = profileIds.length ? profileIds : empty
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()

  const [
    { data: mealPlans },
    { data: trainingPlans },
    { data: recentCheckins },
    { data: allCheckins },
  ] = await Promise.all([
    supabase.from('meal_plans').select('client_id').in('client_id', ids).eq('is_active', true),
    supabase.from('training_plans').select('client_id').in('client_id', ids).eq('is_active', true),
    supabase.from('checkins').select('client_id').in('client_id', ids).gte('created_at', thirtyDaysAgo),
    supabase.from('checkins').select('client_id, created_at').in('client_id', ids).order('created_at', { ascending: false }),
  ])

  const mealSet  = new Set((mealPlans ?? []).map(m => m.client_id))
  const trainSet = new Set((trainingPlans ?? []).map(t => t.client_id))

  const checkinCount30d = (recentCheckins ?? []).reduce<Record<string, number>>((acc, c) => {
    acc[c.client_id] = (acc[c.client_id] ?? 0) + 1
    return acc
  }, {})

  // First occurrence = most recent (ordered DESC)
  const lastActivityMap: Record<string, string> = {}
  for (const c of (allCheckins ?? [])) {
    if (!lastActivityMap[c.client_id]) lastActivityMap[c.client_id] = c.created_at
  }

  const clients: ClientRow[] = (relations ?? []).flatMap(rel => {
    const profile = Array.isArray(rel.profile) ? rel.profile[0] : rel.profile
    if (!profile?.id) return []
    return [{
      id:              rel.id,
      profileId:       profile.id,
      name:            profile.full_name ?? 'Ukjent',
      joinedAt:        rel.created_at,
      status:          (rel.status ?? 'active') as ClientStatus,
      hasMealPlan:     mealSet.has(profile.id),
      hasTrainingPlan: trainSet.has(profile.id),
      checkinCount:    checkinCount30d[profile.id] ?? 0,
      lastActivity:    lastActivityMap[profile.id] ?? null,
      coachName:       coachNameMap.get(rel.coach_id) ?? null,
    }]
  })

  const activeCount    = clients.filter(c => c.status === 'active').length
  const appCount       = clients.filter(c => c.status === 'app_access').length
  const inactiveCount  = clients.filter(c => c.status === 'inactive').length

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1a5c3a]">Klienter</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#ebf5ef] text-[#1a5c3a]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2d8653]" />
              {activeCount} aktive
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              {appCount} app tilgang
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              {inactiveCount} inaktive
            </span>
          </div>
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-100 py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <UserPlus className="w-7 h-7 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Ingen klienter ennå</h3>
          <p className="text-sm text-gray-500 mb-6">Inviter din første klient for å komme i gang</p>
          <InviteClientDialog coachId={user!.id} triggerVariant="success" />
        </div>
      ) : (
        <ClientList clients={clients} coachId={user!.id} />
      )}
    </div>
  )
}
