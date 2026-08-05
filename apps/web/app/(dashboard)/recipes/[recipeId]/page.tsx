import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { RecipeEditor } from '../recipe-editor'
import type { RecipeData } from '../recipe-editor'

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ recipeId: string }>
}) {
  const { recipeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Recipes are visible org-wide (see migration 055), so a coach can open
  // any org-mate's recipe here too — not just their own. RLS enforces the
  // actual visibility; editing/deleting stays owner-only (see the PUT/DELETE
  // handlers in /api/recipes/[recipeId]), so the editor renders read-only
  // for anything the viewer doesn't own.
  const { data } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', recipeId)
    .single()

  if (!data) notFound()

  const recipe: RecipeData = {
    id:           data.id,
    title:        data.title,
    description:  data.description  ?? '',
    instructions: data.instructions ?? '',
    image_url:    data.image_url    ?? '',
    servings:     data.servings     ?? 1,
    ingredients:  data.ingredients  ?? [],
  }

  const readOnly = data.coach_id !== user!.id
  // A coach not in any org can only ever see a recipe they don't own via
  // the standard library (is_standard) — org-sharing RLS wouldn't grant
  // access otherwise — so this distinguishes the two for the read-only
  // banner's wording instead of always blaming "your organization".
  const isStandard = !!data.is_standard

  return <RecipeEditor initial={recipe} readOnly={readOnly} isStandard={isStandard} />
}
