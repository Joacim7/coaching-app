import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import StandaloneTrainingPlanEditor from '../new/standalone-training-editor'

export default async function EditTrainingPlanPage({
  params,
}: {
  params: Promise<{ planId: string }>
}) {
  const { planId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: plan }, { data: clients }, { data: exercises }] = await Promise.all([
    supabase
      .from('training_plans')
      .select('*, sessions:training_sessions(*), client:profiles!client_id(full_name)')
      .eq('id', planId)
      .eq('coach_id', user!.id)
      .single(),
    supabase
      .from('coach_clients')
      .select('client_id, profile:profiles!client_id(full_name)')
      .eq('coach_id', user!.id)
      .eq('status', 'active'),
    supabase
      .from('exercises')
      .select('id, coach_id, name, description, instructions, muscle_groups, primary_muscles, categories, equipment, video_url, thumbnail_url, is_standard, created_at')
      .or(`is_standard.eq.true,coach_id.eq.${user!.id}`)
      .order('name'),
  ])

  if (!plan) notFound()

  const client = Array.isArray(plan.client) ? plan.client[0] : plan.client

  const clientList = (clients ?? []).map(c => {
    const profile = Array.isArray(c.profile) ? c.profile[0] : c.profile
    return { id: c.client_id, name: profile?.full_name ?? 'Ukjent' }
  })

  return (
    <StandaloneTrainingPlanEditor
      clientId={plan.client_id ?? null}
      clientName={client?.full_name ?? null}
      coachId={user!.id}
      clients={clientList}
      exercises={exercises ?? []}
      initialPlan={{
        id: plan.id,
        title: plan.title,
        description: plan.description,
        sessions: plan.sessions ?? [],
      }}
    />
  )
}
