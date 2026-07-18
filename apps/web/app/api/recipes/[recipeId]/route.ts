import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchPexelsImage } from '@/lib/pexels'

type Ctx = { params: Promise<{ recipeId: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { recipeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', recipeId)
    .eq('coach_id', user.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: Request, { params }: Ctx) {
  const { recipeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, description, instructions, image_url, servings, meal_type, ingredients,
          calories_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving } = body

  const resolvedImage = image_url || (await fetchPexelsImage(title)) || null

  const { data, error } = await supabase
    .from('recipes')
    .update({
      title:                title,
      description:          description          ?? null,
      instructions:         instructions         ?? null,
      image_url:            resolvedImage,
      servings:             servings             ?? 1,
      meal_type:            meal_type            ?? null,
      ingredients:          ingredients          ?? [],
      calories_per_serving: calories_per_serving ?? null,
      protein_per_serving:  protein_per_serving  ?? null,
      carbs_per_serving:    carbs_per_serving    ?? null,
      fat_per_serving:      fat_per_serving      ?? null,
    })
    .eq('id', recipeId)
    .eq('coach_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { recipeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('recipes')
    .delete()
    .eq('id', recipeId)
    .eq('coach_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
