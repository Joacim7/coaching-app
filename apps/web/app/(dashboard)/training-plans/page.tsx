import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getOrgSharedIds } from '@/lib/org-shared'
import { TrainingPlanList, type PlanRow } from './training-plan-list'

export default async function TrainingPlansPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const sharedIds = await getOrgSharedIds(supabase, user!.id, 'training_plan')
  const sharedSet = new Set(sharedIds)

  const base = supabase
    .from('training_plans')
    .select('id, title, description, client_id, created_at, client:profiles!client_id(full_name)')
    .order('created_at', { ascending: false })

  const [{ data: plans }, { data: sessions }, { data: clientRels }] = await Promise.all([
    sharedIds.length > 0
      ? base.or(`coach_id.eq.${user!.id},id.in.(${sharedIds.join(',')})`)
      : base.eq('coach_id', user!.id),
    supabase
      .from('training_sessions')
      .select('training_plan_id'),
    supabase
      .from('coach_clients')
      .select('client_id, profile:profiles!client_id(id, full_name)')
      .eq('coach_id', user!.id),
  ])

  // Session count per plan
  const sessionCount: Record<string, number> = {}
  for (const s of sessions ?? []) {
    sessionCount[s.training_plan_id] = (sessionCount[s.training_plan_id] ?? 0) + 1
  }

  // Client list for "Bruk mal"
  const clientList = (clientRels ?? []).map(r => {
    const p = Array.isArray(r.profile) ? r.profile[0] : r.profile
    return { id: r.client_id, name: p?.full_name ?? 'Ukjent' }
  })

  const rows: PlanRow[] = (plans ?? []).map(plan => {
    const client = Array.isArray(plan.client) ? plan.client[0] : plan.client
    return {
      id:            plan.id,
      title:         plan.title,
      description:   plan.description ?? null,
      client_id:     plan.client_id ?? null,
      client_name:   client?.full_name ?? null,
      session_count: sessionCount[plan.id] ?? 0,
      created_at:    plan.created_at,
      is_org_shared: sharedSet.has(plan.id),
    }
  })

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1a5c3a]">Treningsplaner</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Opprett maler og tildel dem til klienter
          </p>
        </div>
        <Link
          href="/training-plans/new"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-white text-sm font-semibold transition-all [background:linear-gradient(to_right,#1a5c3a,#6ecfb0)] hover:[background:#1a5c3a]"
        >
          <Plus className="w-4 h-4" />
          Opprett treningsplan
        </Link>
      </div>

      <TrainingPlanList plans={rows} clients={clientList} sharedIds={sharedSet} />
    </div>
  )
}
