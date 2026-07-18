import { createClient } from '@/lib/supabase/server'
import { IngredientsView, type CustomIngredient } from './ingredients-view'

export default async function IngredientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data } = await supabase
    .from('custom_ingredients')
    .select('*')
    .eq('coach_id', user!.id)
    .order('name', { ascending: true })

  return <IngredientsView initialCustom={(data ?? []) as CustomIngredient[]} />
}
