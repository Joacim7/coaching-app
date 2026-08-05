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

  return <RecipeEditor initial={recipe} readOnly={readOnly} />
}
