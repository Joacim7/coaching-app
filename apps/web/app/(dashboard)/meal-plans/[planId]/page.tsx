import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import StandaloneMealPlanEditor from './meal-plan-editor-standalone'

export default async function EditMealPlanPage({
  params,
}: {
  params: Promise<{ planId: string }>
}) {
  const { planId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: plan } = await supabase
    .from('meal_plans')
    .select('*, client:profiles!client_id(full_name)')
    .eq('id', planId)
    .eq('coach_id', user!.id)
    .single()

  if (!plan) notFound()

  const client = Array.isArray(plan.client) ? plan.client[0] : plan.client

  const { data: clients } = await supabase
    .from('coach_clients')
    .select('client_id, profile:profiles!client_id(full_name)')
    .eq('coach_id', user!.id)
    .eq('status', 'active')

  const clientList = (clients ?? []).map(c => {
    const profile = Array.isArray(c.profile) ? c.profile[0] : c.profile
    return { id: c.client_id, name: profile?.full_name ?? 'Ukjent' }
  })

  return (
    <StandaloneMealPlanEditor
      clientId={plan.client_id ?? null}
      clientName={client?.full_name ?? null}
      coachId={user!.id}
      clients={clientList}
      initialPlan={plan}
    />
  )
}
