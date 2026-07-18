import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function verifyOwnership(supabase: Awaited<ReturnType<typeof createClient>>, docId: string, userId: string) {
  const { data } = await supabase
    .from('coach_documents')
    .select('id')
    .eq('id', docId)
    .eq('coach_id', userId)
    .single()
  return !!data
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await verifyOwnership(supabase, id, user.id)))
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('coach_document_shares')
    .select('client_id')
    .eq('document_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ clientIds: (data ?? []).map(r => r.client_id) })
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await verifyOwnership(supabase, id, user.id)))
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { clientIds } = await req.json() as { clientIds: string[] }
  if (!Array.isArray(clientIds))
    return NextResponse.json({ error: 'clientIds must be an array' }, { status: 400 })

  // Replace entire share set
  const { error: delErr } = await supabase
    .from('coach_document_shares')
    .delete()
    .eq('document_id', id)

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  if (clientIds.length > 0) {
    const { error: insErr } = await supabase
      .from('coach_document_shares')
      .insert(clientIds.map(client_id => ({ document_id: id, client_id })))

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, count: clientIds.length })
}
