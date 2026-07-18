import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { MealPlanList, type MealPlanRow } from './meal-plan-list'

export default async function MealPlansPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: plans }, { data: clientRels }] = await Promise.all([
    supabase
      .from('meal_plans')
      .select('id, title, client_id, is_template, calories_target, protein_g, meals, created_at')
      .eq('coach_id', user!.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('coach_clients')
      .select('client_id, profile:profiles!client_id(full_name)')
      .eq('coach_id', user!.id),
  ])

  const clientList = (clientRels ?? []).map(r => {
    const p = Array.isArray(r.profile) ? r.profile[0] : r.profile
    return { id: r.client_id, name: p?.full_name ?? 'Ukjent' }
  })

  const clientMap = new Map(clientList.map(c => [c.id, c.name]))

  const rows: MealPlanRow[] = (plans ?? []).map(plan => {
    const meals = Array.isArray(plan.meals) ? plan.meals : []
    return {
      id:              plan.id,
      title:           plan.title,
      client_id:       plan.client_id ?? null,
      is_template:     plan.is_template ?? plan.client_id === null,
      client_name:     plan.client_id ? (clientMap.get(plan.client_id) ?? null) : null,
      calories_target: plan.calories_target ?? null,
      protein_g:       plan.protein_g ?? null,
      meal_count:      meals.length,
      created_at:      plan.created_at,
    }
  })

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1a5c3a]">Matplaner</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Opprett maler og tildel dem til klienter
          </p>
        </div>
        <Link
          href="/meal-plans/new"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-white text-sm font-semibold transition-all [background:linear-gradient(to_right,#1a5c3a,#6ecfb0)] hover:[background:#1a5c3a]"
        >
          <Plus className="w-4 h-4" />
          Opprett matplan
        </Link>
      </div>

      <MealPlanList plans={rows} clients={clientList} />
    </div>
  )
}
