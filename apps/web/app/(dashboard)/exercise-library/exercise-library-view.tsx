'use client'

import { useState, useMemo } from 'react'
import { Search, Video, MoreVertical, Trash2, Pencil, Copy, Dumbbell, Share2 } from 'lucide-react'
import { ExerciseFormModal, ExerciseModal, type ExerciseRow, type FormMode } from './exercise-form-modal'
import { exerciseThumbnail } from '@/lib/video-thumbnail'

type Tab = 'alle' | 'mine' | 'standard'

const FILTER_MUSCLES = ['Alle muskelgrupper', 'Bryst', 'Rygg', 'Skuldre', 'Armer', 'Bein', 'Mage/Core']

const MUSCLE_COLORS: Record<string, string> = {
  'Bryst':     'bg-[#cdeee3] text-[#1a5c3a]',
  'Rygg':      'bg-emerald-100 text-emerald-700',
  'Skuldre':   'bg-violet-100 text-violet-700',
  'Armer':     'bg-orange-100 text-orange-700',
  'Bein':      'bg-red-100 text-red-700',
  'Mage/Core': 'bg-teal-100 text-teal-700',
}

const EQUIPMENT_ICONS: Record<string, string> = {
  'Kroppsvekt': '🤸', 'Stang': '🏋️', 'Hantel': '💪', 'Kabel': '🔗',
  'Maskin': '⚙️', 'Kettlebell': '🔔', 'Resistance band': '📎',
}

interface Props { initialExercises: ExerciseRow[]; orgSharedIds?: Set<string>; isAdmin?: boolean }

type ModalState = { mode: FormMode; exercise?: ExerciseRow }

export function ExerciseLibraryView({ initialExercises, orgSharedIds = new Set(), isAdmin = false }: Props) {
  const [exercises, setExercises] = useState<ExerciseRow[]>(initialExercises)
  const [tab, setTab]               = useState<Tab>('alle')
  const [search, setSearch]         = useState('')
  const [muscleFilter, setMuscleFilter] = useState('Alle muskelgrupper')
  const [openMenu, setOpenMenu]     = useState<string | null>(null)
  const [deleting, setDeleting]     = useState<string | null>(null)
  const [modal, setModal]           = useState<ModalState | null>(null)

  const mine     = useMemo(() => exercises.filter(e => !e.is_standard), [exercises])
  const standard = useMemo(() => exercises.filter(e => e.is_standard),  [exercises])

  const displayed = useMemo(() => {
    let base = tab === 'mine' ? mine : tab === 'standard' ? standard : exercises
    const q = search.trim().toLowerCase()
    if (q) base = base.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.description?.toLowerCase().includes(q) ||
      e.instructions?.toLowerCase().includes(q)
    )
    if (muscleFilter !== 'Alle muskelgrupper') {
      base = base.filter(e => e.muscle_groups.includes(muscleFilter))
    }
    return base
  }, [exercises, tab, search, muscleFilter, mine, standard])

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSaved(saved: ExerciseRow) {
    setExercises(prev => {
      const idx = prev.findIndex(e => e.id === saved.id)
      if (idx >= 0) {
        // update in place
        const next = [...prev]
        next[idx] = saved
        return next
      }
      return [saved, ...prev]   // prepend new
    })
  }

  function handleCardClick(ex: ExerciseRow) {
    setModal({ mode: ex.is_standard ? 'copy' : 'edit', exercise: ex })
  }

  async function handleDelete(ex: ExerciseRow) {
    const warning = ex.is_standard
      ? `Slett standardøvelsen "${ex.name}"? Dette fjerner den for ALLE coacher. Dette kan ikke angres.`
      : `Slett "${ex.name}"? Dette kan ikke angres.`
    if (!confirm(warning)) return
    setDeleting(ex.id)
    setOpenMenu(null)
    const res = await fetch(`/api/exercises/${ex.id}`, { method: 'DELETE' })
    setDeleting(null)
    if (res.ok) setExercises(prev => prev.filter(e => e.id !== ex.id))
  }

  const tabs = [
    { key: 'alle'     as Tab, label: 'Alle',            count: exercises.length },
    { key: 'mine'     as Tab, label: 'Mine øvelser',    count: mine.length },
    { key: 'standard' as Tab, label: 'Standardøvelser', count: standard.length },
  ]

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a5c3a]">Øvelsesbibliotek</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Bla gjennom standardøvelser eller legg til dine egne
          </p>
        </div>
        <ExerciseFormModal onCreated={ex => setExercises(prev => [ex, ...prev])} />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Søk etter øvelse..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 h-10 rounded-xl border border-gray-200 bg-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      {/* Tabs + muscle filter */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center border-b border-gray-200">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.key
                  ? 'text-[#2d8653] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#2d8653]'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                tab === t.key ? 'bg-[#cdeee3] text-[#1a5c3a]' : 'bg-gray-100 text-gray-500'
              }`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5 pb-px">
          {FILTER_MUSCLES.map(m => (
            <button
              key={m}
              onClick={() => setMuscleFilter(m)}
              className={`px-3 h-7 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                muscleFilter === m
                  ? 'bg-[#1a5c3a] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <Dumbbell className="w-6 h-6 text-gray-300" />
          </div>
          <p className="font-semibold text-gray-500">Ingen øvelser funnet</p>
          <p className="text-sm text-gray-400 mt-1">Prøv et annet søkeord eller filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {displayed.map(ex => {
            const isMenuOpen = openMenu === ex.id
            const isOwn      = !ex.is_standard
            const canDelete  = isOwn || (isAdmin && ex.is_standard)
            const thumb      = exerciseThumbnail(ex)

            return (
              <div key={ex.id} className="relative group">
                {isMenuOpen && (
                  <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                )}

                <div
                  onClick={() => handleCardClick(ex)}
                  className="bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all overflow-hidden flex flex-col cursor-pointer"
                >
                  {/* Thumbnail */}
                  <div className="relative bg-gray-100 aspect-video flex items-center justify-center overflow-hidden">
                    {thumb && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt={ex.name} className="absolute inset-0 w-full h-full object-cover" />
                    )}
                    {ex.video_url ? (
                      <a
                        href={ex.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="absolute inset-0 flex items-center justify-center group/thumb"
                      >
                        <div className="w-12 h-12 rounded-full bg-white/90 shadow-md flex items-center justify-center group-hover/thumb:scale-110 transition-transform">
                          <Video className="w-5 h-5 text-gray-700 translate-x-0.5" />
                        </div>
                        <div className={`absolute inset-0 transition-colors ${thumb ? 'bg-gray-900/10 group-hover/thumb:bg-gray-900/30' : 'bg-gray-900/10 group-hover/thumb:bg-gray-900/20'}`} />
                      </a>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-gray-300">
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <Video className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-medium text-gray-300">Ingen video</span>
                      </div>
                    )}

                    {/* Standard badge */}
                    {ex.is_standard && (
                      <span className="absolute top-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/90 text-gray-600 shadow-sm">
                        STANDARD
                      </span>
                    )}

                    {/* Category badges */}
                    {ex.categories?.length > 0 && (
                      <div className="absolute bottom-2 left-2 flex flex-wrap gap-1 max-w-[calc(100%-1rem)]">
                        {ex.categories.map(c => (
                          <span key={c} className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-black/40 text-white">
                            {c}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 3-dot menu */}
                    <div
                      className="absolute top-2 right-2 z-20"
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        onClick={() => setOpenMenu(isMenuOpen ? null : ex.id)}
                        className="w-7 h-7 rounded-lg bg-white/90 shadow-sm flex items-center justify-center text-gray-500 hover:text-gray-800 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {isMenuOpen && (
                        <div className="absolute right-0 top-9 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-30 min-w-[160px]">
                          {isOwn && (
                            <button
                              onClick={() => { setOpenMenu(null); setModal({ mode: 'edit', exercise: ex }) }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5 text-gray-400" />
                              Rediger
                            </button>
                          )}
                          <button
                            onClick={() => { setOpenMenu(null); setModal({ mode: 'copy', exercise: ex }) }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5 text-gray-400" />
                            Kopier øvelse
                          </button>
                          {canDelete && (
                            <>
                              <div className="mx-2 my-1 border-t border-gray-100" />
                              <button
                                onClick={() => handleDelete(ex)}
                                disabled={deleting === ex.id}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                {deleting === ex.id
                                  ? 'Sletter...'
                                  : ex.is_standard ? 'Slett standardøvelse' : 'Slett'}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="p-4 flex flex-col flex-1">
                    <div className="flex items-start gap-2">
                      <h3 className="font-semibold text-gray-900 text-sm leading-snug flex-1">{ex.name}</h3>
                      {orgSharedIds.has(ex.id) && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 flex-shrink-0">
                          <Share2 className="w-2.5 h-2.5" />
                          Delt
                        </span>
                      )}
                    </div>

                    {(ex.description || ex.instructions) && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                        {ex.description || ex.instructions}
                      </p>
                    )}

                    {/* Equipment icons */}
                    {ex.equipment?.length > 0 && (
                      <div className="flex items-center gap-1 mt-2">
                        {ex.equipment.slice(0, 3).map(eq => (
                          <span key={eq} title={eq} className="text-xs bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded-md text-gray-500">
                            {EQUIPMENT_ICONS[eq] ?? eq.slice(0, 3)}
                          </span>
                        ))}
                        {ex.equipment.length > 3 && (
                          <span className="text-[10px] text-gray-400">+{ex.equipment.length - 3}</span>
                        )}
                      </div>
                    )}

                    {/* Muscle tags */}
                    {ex.muscle_groups?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-auto pt-3">
                        {ex.muscle_groups.map(m => (
                          <span
                            key={m}
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              MUSCLE_COLORS[m] ?? 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit / Copy / Create modal */}
      {modal && (
        <ExerciseModal
          mode={modal.mode}
          exercise={modal.exercise}
          onSaved={handleSaved}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
