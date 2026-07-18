import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ recordingId: string }> }
) {
  const { recordingId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch to verify ownership and get file path
  const { data: rec, error: fetchErr } = await supabase
    .from('recordings')
    .select('file_path')
    .eq('id', recordingId)
    .eq('coach_id', user.id)
    .single()

  if (fetchErr || !rec) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Delete from storage if file exists
  if (rec.file_path) {
    await supabase.storage.from('coach-recordings').remove([rec.file_path])
  }

  const { error } = await supabase
    .from('recordings')
    .delete()
    .eq('id', recordingId)
    .eq('coach_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
