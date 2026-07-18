import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const { docId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Get file_path to delete from storage
  const { data: doc } = await supabase
    .from('org_documents')
    .select('file_path')
    .eq('id', docId)
    .eq('org_id', membership.org_id)
    .single()

  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await Promise.all([
    supabase.storage.from('org-documents').remove([doc.file_path]),
    supabase.from('org_documents').delete().eq('id', docId),
  ])

  return NextResponse.json({ ok: true })
}
