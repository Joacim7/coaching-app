import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import StandaloneTrainingPlanEditor from '@/app/(dashboard)/training-plans/new/standalone-training-editor'

export default async function NewClientTrainingPlanPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: rel }, { data: exercises }] = await Promise.all([
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

  if (!rel) notFound()

  const profile = Array.isArray(rel.profile) ? rel.profile[0] : rel.profile

  return (
    <StandaloneTrainingPlanEditor
      clientId={clientId}
      clientName={profile?.full_name ?? 'Klient'}
      coachId={user!.id}
      clients={[]}
      exercises={exercises ?? []}
      initialPlan={null}
    />
  )
}
