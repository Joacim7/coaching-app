import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ clientId: string; logId: string }> },
) {
  const { clientId, logId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 })

  const { data: rel } = await supabase
    .from('coach_clients')
    .select('client_id')
    .eq('coach_id', user.id)
    .eq('client_id', clientId)
    .single()

  if (!rel) return NextResponse.json({ error: 'Ingen tilgang' }, { status: 403 })

  const { error } = await supabase
    .from('workout_logs')
    .delete()
    .eq('id', logId)
    .eq('client_id', clientId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
