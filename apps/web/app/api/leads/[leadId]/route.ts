import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PATCH — update status / notes on a lead
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const { leadId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if ('status' in body) patch.status = body.status
  if ('notes'  in body) patch.notes  = body.notes ?? null

  const VALID_STATUSES = ['ny', 'kontaktet', 'kvalifisert', 'vunnet', 'tapt']
  if (patch.status && !VALID_STATUSES.includes(patch.status as string)) {
    return NextResponse.json({ error: 'Ugyldig status' }, { status: 400 })
  }

  const { error } = await supabase
    .from('leads')
    .update(patch)
    .eq('id', leadId)
    .eq('coach_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
