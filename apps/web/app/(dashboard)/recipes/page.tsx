import { createClient } from '@/lib/supabase/server'
import { getOrgSharedIds } from '@/lib/org-shared'
import { RecipesView, type RecipeRow } from './recipes-view'

export default async function RecipesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const sharedIds = await getOrgSharedIds(supabase, user!.id, 'recipe')
  const sharedSet = new Set(sharedIds)

  const base  = supabase.from('recipes').select('*').order('created_at', { ascending: false })
  const { data, error } = sharedIds.length > 0
    ? await base.or(`coach_id.eq.${user!.id},id.in.(${sharedIds.join(',')})`)
    : await base.eq('coach_id', user!.id)

  if (error) {
    console.error('[recipes/page] failed to load recipes:', error.message)
  }

  const recipes = (data ?? []).map(r => ({
    ...r,
    is_org_shared: sharedSet.has(r.id) && r.coach_id !== user!.id,
  })) as RecipeRow[]

  return <RecipesView recipes={recipes} loadError={error ? error.message : null} />
}
