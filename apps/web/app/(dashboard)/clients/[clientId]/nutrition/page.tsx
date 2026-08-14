import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import NutritionEditor from './nutrition-editor'

export default async function NutritionPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: rel } = await supabase
    .from('coach_clients')
    .select('client_id, profile:profiles!client_id(full_name)')
    .eq('coach_id', user!.id)
    .eq('client_id', clientId)
    .single()

  if (!rel) notFound()

  const profile = Array.isArray(rel.profile) ? rel.profile[0] : rel.profile

  const { data: plans } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  const { data: foodLogs } = await supabase
    .from('food_log_entries')
    .select('id, created_at, meal_name, meal_type, calories, protein_g, carbs_g, fat_g, ingredients')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(60)

  // Saved from the mobile app (see migration 068 for the RLS policy letting
  // a coach read these — the table only ever had a client-owns-it policy).
  const { data: favoriteMeals } = await supabase
    .from('favorite_meals')
    .select('id, name, meal_type, calories, protein_g, carbs_g, fat_g, created_at, ingredients')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  return (
    <NutritionEditor
      clientId={clientId}
      clientName={profile?.full_name ?? 'Klient'}
      coachId={user!.id}
      initialPlans={(plans ?? []) as import('@coaching/types').MealPlan[]}
      initialFoodLogs={(foodLogs ?? []) as any[]}
      initialFavoriteMeals={(favoriteMeals ?? []) as any[]}
    />
  )
}
