import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import StandaloneTrainingPlanEditor from '@/app/(dashboard)/training-plans/new/standalone-training-editor'

export default async function ClientTrainingPlanPage({
  params,
}: {
  params: Promise<{ clientId: string; planId: string }>
}) {
  const { clientId, planId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: plan }, { data: rel }, { data: exercises }] = await Promise.all([
    supabase
      .from('training_plans')
      .select('*, sessions:training_sessions(*)')
      .eq('id', planId)
      .eq('coach_id', user!.id)
      .single(),
    supabase
      .from('coach_clients')
      .select('client_id, profile:profiles!client_id(full_name)')
      .eq('coach_id', user!.id)
      .eq('client_id', clientId)
      .single(),
    supabase
      .from('exercises')
      .select('id, coach_id, name, description, instructions, muscle_groups, primary_muscles, categories, equipment, video_url, thumbnail_url, is_standard, created_at')
      .or(`is_standard.eq.true,coach_id.eq.${user!.id}`)
      .order('name'),
  ])

  if (!plan || !rel) notFound()

  const profile = Array.isArray(rel.profile) ? rel.profile[0] : rel.profile

  return (
    <StandaloneTrainingPlanEditor
      clientId={clientId}
      clientName={profile?.full_name ?? 'Klient'}
      coachId={user!.id}
      clients={[]}
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
