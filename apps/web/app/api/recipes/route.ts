import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchPexelsImage } from '@/lib/pexels'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, description, instructions, image_url, servings, meal_type, ingredients,
          calories_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving } = body

  if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const resolvedImage = image_url || (await fetchPexelsImage(title.trim())) || null

  const { data, error } = await supabase
    .from('recipes')
    .insert({
      coach_id: user.id,
      title: title.trim(),
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
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
