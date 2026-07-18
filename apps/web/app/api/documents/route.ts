import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('coach_documents')
    .select('*, shares:coach_document_shares(client_id)')
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []).map(doc => ({
    ...doc,
    share_count: Array.isArray(doc.shares) ? doc.shares.length : 0,
    shares: undefined,
  }))

  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description, file_path, file_size_bytes, file_type } = await req.json()
  if (!name || !file_path) return NextResponse.json({ error: 'name and file_path required' }, { status: 400 })

  const { data, error } = await supabase
    .from('coach_documents')
    .insert({ coach_id: user.id, name, description: description ?? null, file_path, file_size_bytes: file_size_bytes ?? null, file_type: file_type ?? null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ...data, share_count: 0 }, { status: 201 })
}
