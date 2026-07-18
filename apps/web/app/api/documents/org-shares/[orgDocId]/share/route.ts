import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgDocId: string }> },
) {
  const { orgDocId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('org_document_shares')
    .select('client_id')
    .eq('org_document_id', orgDocId)
    .eq('coach_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ clientIds: (data ?? []).map(r => r.client_id) })
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgDocId: string }> },
) {
  const { orgDocId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify caller is an org member
  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json({ error: 'Not an org member' }, { status: 403 })

  const { clientIds } = await req.json() as { clientIds: string[] }
  if (!Array.isArray(clientIds))
    return NextResponse.json({ error: 'clientIds must be an array' }, { status: 400 })

  // Remove shares for clients no longer in the list
  const { error: delErr } = await supabase
    .from('org_document_shares')
    .delete()
    .eq('org_document_id', orgDocId)
    .eq('coach_id', user.id)

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  if (clientIds.length > 0) {
    const { error: insErr } = await supabase
      .from('org_document_shares')
      .insert(
        clientIds.map(client_id => ({
          org_document_id: orgDocId,
          coach_id:        user.id,
          client_id,
        }))
      )

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
