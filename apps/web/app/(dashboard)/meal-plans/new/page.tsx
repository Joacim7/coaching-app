import { createClient } from '@/lib/supabase/server'
import StandaloneMealPlanEditor from '../[planId]/meal-plan-editor-standalone'

export default async function NewMealPlanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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
      clientId={null}
      clientName={null}
      coachId={user!.id}
      clients={clientList}
      initialPlan={null}
    />
  )
}
