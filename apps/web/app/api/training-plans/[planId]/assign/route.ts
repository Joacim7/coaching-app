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
    .from('training_plans')
    .select('*, sessions:training_sessions(*)')
    .eq('id', planId)
    .eq('coach_id', user.id)
    .single()

  if (fetchError || !original) {
    return NextResponse.json({ error: 'Plan ikke funnet' }, { status: 404 })
  }

  const { data: newPlan, error: insertError } = await supabase
    .from('training_plans')
    .insert({
      title: original.title,
      description: original.description,
      client_id: clientId,
      coach_id: user.id,
      is_active: true,
    })
    .select('id')
    .single()

  if (insertError || !newPlan) {
    return NextResponse.json({ error: 'Kunne ikke kopiere plan' }, { status: 500 })
  }

  if (original.sessions?.length > 0) {
    await supabase.from('training_sessions').insert(
      original.sessions.map((s: { day_of_week: number; title: string; exercises: unknown }) => ({
        training_plan_id: newPlan.id,
        day_of_week: s.day_of_week,
        title: s.title,
        exercises: s.exercises,
      }))
    )
  }

  return NextResponse.json({ newPlanId: newPlan.id })
}
