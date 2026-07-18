'use client'

import { useState } from 'react'
import { X, Check } from 'lucide-react'

export interface Photo {
  id: string
  signedUrl: string | null
  date: string
  notes: string | null
}

const MAX_COMPARE = 4

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function PhotosGrid({ photos }: { photos: Photo[] }) {
  const [selected, setSelected]     = useState<string[]>([])
  const [comparing, setComparing]   = useState(false)
  const [previewId, setPreviewId]   = useState<string | null>(null)

  function toggle(id: string) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= MAX_COMPARE) return prev
      return [...prev, id]
    })
  }

  // Preserve the order the user picked them in, not the grid order
  const selectedPhotos = selected
    .map(id => photos.find(p => p.id === id))
    .filter((p): p is Photo => p != null)

  const previewPhoto = previewId ? photos.find(p => p.id === previewId) ?? null : null

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-gray-900">Progresjonsbilder</h3>
        <div className="flex items-center gap-3">
          {selected.length > 0 && (
            <button
              onClick={() => setSelected([])}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Avbryt valg
            </button>
          )}
          <span className="text-xs text-gray-400">{photos.length} bilde{photos.length !== 1 ? 'r' : ''}</span>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-4">
        Klikk på et bilde for å se det. Klikk på sirkelen for å velge opptil {MAX_COMPARE} bilder å sammenligne.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
        {photos.map(p => {
          const isSelected  = selected.includes(p.id)
          const selectDisabled = !isSelected && selected.length >= MAX_COMPARE

          return (
            <div key={p.id} className="relative">
              <div onClick={() => setPreviewId(p.id)} className="cursor-pointer">
                <div
                  className={`aspect-[3/4] rounded-xl overflow-hidden bg-gray-100 ring-2 transition-colors ${
                    isSelected ? 'ring-[#2d8653]' : 'ring-transparent'
                  }`}
                >
                  {p.signedUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.signedUrl}
                      alt={`Fremgangsbilde ${formatDate(p.date)}`}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <p className="text-xs text-gray-500 text-center mt-1.5">{formatDate(p.date)}</p>
                {p.notes && (
                  <p className="text-[11px] text-gray-400 text-center mt-0.5 line-clamp-1">{p.notes}</p>
                )}
              </div>

              <button
                onClick={() => !selectDisabled && toggle(p.id)}
                disabled={selectDisabled}
                title={isSelected ? 'Fjern fra sammenligning' : 'Velg for sammenligning'}
                className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${
                  isSelected
                    ? 'bg-[#2d8653] border-[#2d8653]'
                    : selectDisabled
                      ? 'bg-white/40 border-white/40 cursor-not-allowed'
                      : 'bg-white/70 border-white hover:bg-white'
                }`}
              >
                {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
              </button>
            </div>
          )
        })}
      </div>

      {selected.length >= 2 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60]">
          <button
            onClick={() => setComparing(true)}
            className="bg-[#1a5c3a] text-white text-sm font-semibold px-5 py-3 rounded-full shadow-lg hover:bg-[#164a2f] transition-colors"
          >
            Sammenlign {selected.length} bilder
          </button>
        </div>
      )}

      {/* Single photo preview */}
      {previewPhoto && (
        <div
          className="fixed inset-0 bg-black/85 z-[60] flex flex-col p-6"
          onClick={() => setPreviewId(null)}
        >
          <div className="flex justify-end mb-4">
            <button onClick={() => setPreviewId(null)} className="text-white/70 hover:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center" onClick={e => e.stopPropagation()}>
            {previewPhoto.signedUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewPhoto.signedUrl}
                alt={formatDate(previewPhoto.date)}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            )}
          </div>
          <p className="text-white text-sm font-medium text-center mt-3">{formatDate(previewPhoto.date)}</p>
          {previewPhoto.notes && (
            <p className="text-white/60 text-xs text-center mt-1">{previewPhoto.notes}</p>
          )}
        </div>
      )}

      {/* Comparison view */}
      {comparing && (
        <div
          className="fixed inset-0 bg-black/85 z-[60] flex flex-col p-6"
          onClick={() => setComparing(false)}
        >
          <div className="flex justify-end mb-4">
            <button onClick={() => setComparing(false)} className="text-white/70 hover:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div
            className={`flex-1 min-h-0 grid gap-4 ${selectedPhotos.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 grid-rows-2'}`}
            onClick={e => e.stopPropagation()}
          >
            {selectedPhotos.map(p => (
              <div key={p.id} className="relative min-h-0 min-w-0">
                {p.signedUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.signedUrl}
                    alt={formatDate(p.date)}
                    className="absolute inset-0 w-full h-full object-contain rounded-lg"
                  />
                )}
                <p className="absolute bottom-0 left-0 right-0 text-white text-sm font-medium text-center bg-black/50 py-1.5 rounded-b-lg">
                  {formatDate(p.date)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
