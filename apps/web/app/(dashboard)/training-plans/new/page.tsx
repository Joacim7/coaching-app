import { createClient } from '@/lib/supabase/server'
import StandaloneTrainingPlanEditor from './standalone-training-editor'

export default async function NewTrainingPlanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: clients }, { data: exercises }] = await Promise.all([
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

  const clientList = (clients ?? []).map(c => {
    const profile = Array.isArray(c.profile) ? c.profile[0] : c.profile
    return { id: c.client_id, name: profile?.full_name ?? 'Ukjent' }
  })

  return (
    <StandaloneTrainingPlanEditor
      clientId={null}
      clientName={null}
      coachId={user!.id}
      clients={clientList}
      exercises={exercises ?? []}
      initialPlan={null}
    />
  )
}
