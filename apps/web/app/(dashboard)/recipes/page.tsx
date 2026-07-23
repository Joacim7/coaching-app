import { createClient } from '@/lib/supabase/server'
import { RecipesView, type RecipeRow } from './recipes-view'

export default async function RecipesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Recipes are visible org-wide (see migration 055) — a coach sees every
  // recipe created by anyone in their organization, not just their own or
  // ones explicitly curated via org_shared_resources.
  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user!.id)
    .single()

  let coachIds = [user!.id]
  if (membership) {
    const { data: orgMates } = await supabase
      .from('org_members')
      .select('user_id')
      .eq('org_id', membership.org_id)
    if (orgMates?.length) coachIds = orgMates.map(m => m.user_id)
  }

  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .in('coach_id', coachIds)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[recipes/page] failed to load recipes:', error.message)
  }

  const recipes = (data ?? []).map(r => ({
    ...r,
    is_org_shared: r.coach_id !== user!.id,
  })) as RecipeRow[]

  return <RecipesView recipes={recipes} loadError={error ? error.message : null} />
}
