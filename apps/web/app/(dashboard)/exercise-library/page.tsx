import { createClient } from '@/lib/supabase/server'
import { getOrgSharedIds } from '@/lib/org-shared'
import { ExerciseLibraryView } from './exercise-library-view'
import type { ExerciseRow } from './new-exercise-dialog'

export default async function ExerciseLibraryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const sharedIds = await getOrgSharedIds(supabase, user!.id, 'exercise')

  const { data: adminMembership } = await supabase
    .from('org_members')
    .select('role')
    .eq('user_id', user!.id)
    .eq('role', 'admin')
    .maybeSingle()
  const isAdmin = !!adminMembership

  const orFilter = sharedIds.length > 0
    ? `is_standard.eq.true,coach_id.eq.${user!.id},id.in.(${sharedIds.join(',')})`
    : `is_standard.eq.true,coach_id.eq.${user!.id}`

  const { data } = await supabase
    .from('exercises')
    .select('*')
    .or(orFilter)
    .order('is_standard', { ascending: false })
    .order('name', { ascending: true })

  const exercises = (data ?? []) as ExerciseRow[]

  return (
    <ExerciseLibraryView
      initialExercises={exercises}
      orgSharedIds={new Set(sharedIds)}
      isAdmin={isAdmin}
    />
  )
}
