import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 })

  const { data, error } = await supabase
    .from('client_phases')
    .select('*')
    .eq('client_id', clientId)
    .eq('coach_id', user.id)
    .order('start_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 })

  const body = await req.json() as {
    name: string
    color: string
    phase_type?: string | null
    description?: string | null
    start_date: string
    end_date?: string | null
    notes?: string | null
    training_plan_id?: string | null
    meal_plan_id?: string | null
  }

  if (!body.name?.trim() || !body.start_date) {
    return NextResponse.json({ error: 'Navn og startdato er påkrevd' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('client_phases')
    .insert({
      coach_id:         user.id,
      client_id:        clientId,
      name:             body.name.trim(),
      color:            body.color ?? '#3b82f6',
      phase_type:       body.phase_type ?? null,
      description:      body.description ?? null,
      start_date:       body.start_date,
      end_date:         body.end_date ?? null,
      notes:            body.notes ?? null,
      training_plan_id: body.training_plan_id ?? null,
      meal_plan_id:     body.meal_plan_id ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
