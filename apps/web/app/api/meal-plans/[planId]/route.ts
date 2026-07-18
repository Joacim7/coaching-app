import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Ctx = { params: Promise<{ planId: string }> }

export async function DELETE(_req: Request, { params }: Ctx) {
  const { planId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('meal_plans')
    .delete()
    .eq('id', planId)
    .eq('coach_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function POST(req: Request, { params }: Ctx) {
  const { planId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action } = await req.json()
  if (action !== 'duplicate') return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  const { data: original } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('id', planId)
    .eq('coach_id', user.id)
    .single()

  if (!original) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: copy, error } = await supabase
    .from('meal_plans')
    .insert({
      coach_id:        user.id,
      client_id:       null,
      title:           `${original.title} (kopi)`,
      calories_target: original.calories_target,
      protein_g:       original.protein_g,
      carbs_g:         original.carbs_g,
      fat_g:           original.fat_g,
      meals:           original.meals,
      is_active:       true,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ newPlanId: copy.id })
}
