import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ClientStatus } from '@coaching/types'

const VALID: ClientStatus[] = ['active', 'inactive', 'new', 'onboarding', 'course', 'followup', 'app_access']

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 })

  const { clientId } = await params
  const { status } = await req.json() as { status: ClientStatus }

  if (!VALID.includes(status)) {
    return NextResponse.json({ error: 'Ugyldig status' }, { status: 400 })
  }

  const { error } = await supabase
    .from('coach_clients')
    .update({ status })
    .eq('client_id', clientId)
    .eq('coach_id', user.id)

  if (error) {
    console.error('[client-status] DB error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
