import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: doc, error: fetchErr } = await supabase
    .from('coach_documents')
    .select('id, file_path')
    .eq('id', id)
    .eq('coach_id', user.id)
    .single()

  if (fetchErr || !doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error: storageErr } = await supabase.storage
    .from('coach-documents')
    .remove([doc.file_path])

  if (storageErr) return NextResponse.json({ error: storageErr.message }, { status: 500 })

  const { error: dbErr } = await supabase
    .from('coach_documents')
    .delete()
    .eq('id', id)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
