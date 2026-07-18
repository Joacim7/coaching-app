import { createClient } from '@/lib/supabase/server'
import { RecordingsView, type RecordingRow } from './recordings-view'

export default async function RecordingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: rows } = await supabase
    .from('recordings')
    .select('*')
    .eq('coach_id', user!.id)
    .order('created_at', { ascending: false })

  // For each row, use stored share_url if available; otherwise derive it
  // from file_path via getPublicUrl (synchronous — no network call needed
  // because the bucket is public).
  const recordings: RecordingRow[] = (rows ?? []).map((r) => {
    let shareUrl = r.share_url ?? null
    if (!shareUrl && r.file_path) {
      const { data } = supabase.storage
        .from('coach-recordings')
        .getPublicUrl(r.file_path)
      shareUrl = data.publicUrl
    }
    return { ...r, share_url: shareUrl }
  })

  return <RecordingsView initialRecordings={recordings} />
}
