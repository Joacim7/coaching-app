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

  const { data } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', recipeId)
    .eq('coach_id', user!.id)
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

  return <RecipeEditor initial={recipe} />
}
