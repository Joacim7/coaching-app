import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 })

  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .or(`is_standard.eq.true,coach_id.eq.${user.id}`)
    .order('is_standard', { ascending: false })
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 })

  const body = await req.json() as {
    name: string
    description?: string
    instructions?: string
    muscle_groups: string[]
    primary_muscles?: string[]
    categories?: string[]
    equipment?: string[]
    video_url?: string
    thumbnail_url?: string | null
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Navn er påkrevd' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('exercises')
    .insert({
      coach_id:        user.id,
      name:            body.name.trim(),
      description:     body.description?.trim() ?? null,
      instructions:    body.instructions?.trim() ?? null,
      muscle_groups:   body.muscle_groups ?? [],
      primary_muscles: body.primary_muscles ?? [],
      categories:      body.categories ?? [],
      equipment:       body.equipment ?? [],
      video_url:       body.video_url?.trim() ?? null,
      thumbnail_url:   body.thumbnail_url ?? null,
      is_standard:     false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
