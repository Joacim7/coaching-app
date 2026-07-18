import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 })

  const { clientId } = await req.json()
  if (!clientId) return NextResponse.json({ error: 'clientId mangler' }, { status: 400 })

  const { data: original, error: fetchError } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('id', planId)
    .eq('coach_id', user.id)
    .single()

  if (fetchError || !original) {
    return NextResponse.json({ error: 'Plan ikke funnet' }, { status: 404 })
  }

  const { data: newPlan, error: insertError } = await supabase
    .from('meal_plans')
    .insert({
      title: original.title,
      client_id: clientId,
      coach_id: user.id,
      calories_target: original.calories_target,
      protein_g: original.protein_g,
      carbs_g: original.carbs_g,
      fat_g: original.fat_g,
      meals: original.meals,
      is_active: true,
    })
    .select('id')
    .single()

  if (insertError || !newPlan) {
    return NextResponse.json({ error: 'Kunne ikke kopiere plan' }, { status: 500 })
  }

  return NextResponse.json({ newPlanId: newPlan.id })
}
