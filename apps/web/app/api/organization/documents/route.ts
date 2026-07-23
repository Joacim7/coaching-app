import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/organization/documents — list shared documents
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json([])

  const { data } = await supabase
    .from('org_documents')
    .select('id, name, description, file_path, file_size_bytes, file_type, created_at, uploaded_by, profiles!uploaded_by(full_name)')
    .eq('org_id', membership.org_id)
    .order('created_at', { ascending: false })

  return NextResponse.json(data ?? [])
}

// POST /api/organization/documents — save document metadata after storage upload
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .single()

  if (!membership)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, description, file_path, file_size_bytes, file_type } = await req.json()
  if (!name || !file_path) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { data, error } = await supabase
    .from('org_documents')
    .insert({
      org_id:          membership.org_id,
      name,
      description,
      file_path,
      file_size_bytes,
      file_type,
      uploaded_by:     user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
