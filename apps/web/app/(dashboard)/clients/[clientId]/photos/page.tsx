import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Camera } from 'lucide-react'
import { PhotosGrid } from './photos-grid'

export default async function PhotosPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: rel } = await supabase
    .from('coach_clients')
    .select('client_id')
    .eq('coach_id', user!.id)
    .eq('client_id', clientId)
    .single()

  if (!rel) notFound()

  const { data: photoRows } = await supabase
    .from('progress_photos')
    .select('id, photo_url, date, notes')
    .eq('client_id', clientId)
    .order('date', { ascending: false })

  const rows = photoRows ?? []

  // photo_url stores the storage object PATH (the bucket is private), so it
  // must be exchanged for a signed URL before it can be rendered.
  const { data: signed } = rows.length
    ? await supabase.storage.from('progress-photos').createSignedUrls(rows.map(r => r.photo_url), 3600)
    : { data: [] as { signedUrl: string }[] }

  const photos = rows.map((r, i) => ({ ...r, signedUrl: signed?.[i]?.signedUrl ?? null }))

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-pink-100 flex items-center justify-center mb-4">
          <Camera className="w-7 h-7 text-pink-600" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Progresjonsbilder</h3>
        <p className="text-sm text-gray-400 max-w-xs">
          Klienten har ikke lastet opp noen fremgangsbilder ennå.
        </p>
      </div>
    )
  }

  return <PhotosGrid photos={photos} />
}
