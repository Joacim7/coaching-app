import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 })

  const { error } = await supabase
    .from('training_plans')
    .delete()
    .eq('id', planId)
    .eq('coach_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 })

  const { action } = await req.json() as { action: 'duplicate' }

  if (action === 'duplicate') {
    const { data: src, error: fetchErr } = await supabase
      .from('training_plans')
      .select('*, sessions:training_sessions(*)')
      .eq('id', planId)
      .eq('coach_id', user.id)
      .single()

    if (fetchErr || !src) return NextResponse.json({ error: 'Ikke funnet' }, { status: 404 })

    const { data: copy, error: cpErr } = await supabase
      .from('training_plans')
      .insert({
        coach_id:    user.id,
        client_id:   null,
        title:       `${src.title} (kopi)`,
        description: src.description,
        is_active:   true,
      })
      .select()
      .single()

    if (cpErr || !copy) return NextResponse.json({ error: cpErr?.message }, { status: 500 })

    if (src.sessions?.length) {
      await supabase.from('training_sessions').insert(
        src.sessions.map(({ id: _id, training_plan_id: _tpid, ...rest }: { id: string; training_plan_id: string; [key: string]: unknown }) => ({
          ...rest,
          training_plan_id: copy.id,
        })),
      )
    }

    return NextResponse.json({ newPlanId: copy.id }, { status: 201 })
  }

  return NextResponse.json({ error: 'Ukjent action' }, { status: 400 })
}
