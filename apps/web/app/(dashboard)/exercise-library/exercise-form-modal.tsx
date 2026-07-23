'use client'

import { useState } from 'react'
import { X, Plus, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { youTubeThumbnail } from '@/lib/video-thumbnail'

// ── Shared type ───────────────────────────────────────────────────────────────

export interface ExerciseRow {
  id: string
  coach_id: string | null
  name: string
  description: string | null
  instructions: string | null
  muscle_groups: string[]
  primary_muscles: string[]
  categories: string[]
  equipment: string[]
  video_url: string | null
  thumbnail_url: string | null
  is_standard: boolean
  created_at: string
}

// ── Static options ────────────────────────────────────────────────────────────

export const MUSCLE_GROUPS = ['Bryst', 'Rygg', 'Skuldre', 'Armer', 'Bein', 'Mage/Core']

const CATEGORIES = ['Styrke', 'Hypertrofi', 'Kondisjon', 'Kroppsvekt', 'Mobilitet', 'Olympisk løft']

const EQUIPMENT = [
  'Kroppsvekt', 'Stang', 'Hantel', 'Kabel', 'Maskin',
  'Kettlebell', 'Resistance band', 'Pull-up-stang', 'Dip-stasjon', 'Medisinball',
]

const PRIMARY_MUSCLES = [
  // Bryst
  'Pectoralis major', 'Pectoralis minor', 'Serratus anterior',
  // Rygg
  'Latissimus dorsi', 'Trapezius øvre', 'Trapezius nedre', 'Rhomboids', 'Erector spinae',
  // Skuldre
  'Deltoid fremre', 'Deltoid midtre', 'Deltoid bakre', 'Rotatormansjett',
  // Armer
  'Biceps brachii', 'Brachialis', 'Brachioradialis', 'Triceps brachii', 'Underarm',
  // Bein
  'Quadriceps', 'Hamstrings', 'Gluteus maximus', 'Gluteus medius',
  'Gastrocnemius', 'Soleus', 'Adduktorer',
  // Mage/Core
  'Rectus abdominis', 'Obliques', 'Transversus abdominis', 'Hip flexors',
]

// ── Types ─────────────────────────────────────────────────────────────────────

export type FormMode = 'create' | 'edit' | 'copy'

type FormState = {
  name: string
  description: string
  instructions: string
  categories: string[]
  muscle_groups: string[]
  primary_muscles: string[]
  equipment: string[]
  video_url: string
}

function emptyForm(): FormState {
  return {
    name: '', description: '', instructions: '',
    categories: [], muscle_groups: [], primary_muscles: [], equipment: [], video_url: '',
  }
}

function fromExercise(ex: ExerciseRow, mode: FormMode): FormState {
  return {
    name:            mode === 'copy' ? `${ex.name} (kopi)` : ex.name,
    description:     ex.description     ?? '',
    instructions:    ex.instructions    ?? '',
    categories:      ex.categories      ?? [],
    muscle_groups:   ex.muscle_groups   ?? [],
    primary_muscles: ex.primary_muscles ?? [],
    equipment:       ex.equipment       ?? [],
    video_url:       ex.video_url       ?? '',
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]
}

// ── Modal component ───────────────────────────────────────────────────────────

interface ModalProps {
  mode: FormMode
  exercise?: ExerciseRow
  onSaved: (exercise: ExerciseRow) => void
  onClose: () => void
}

const TITLES: Record<FormMode, string> = {
  create: 'Ny øvelse',
  edit:   'Rediger øvelse',
  copy:   'Kopier øvelse',
}
const SAVE_LABELS: Record<FormMode, string> = {
  create: 'Lagre øvelse',
  edit:   'Oppdater øvelse',
  copy:   'Lagre kopi',
}

export function ExerciseModal({ mode, exercise, onSaved, onClose }: ModalProps) {
  const [form, setForm] = useState<FormState>(() =>
    exercise ? fromExercise(exercise, mode) : emptyForm()
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    setError('')

    const trimmedVideoUrl = form.video_url.trim()

    const payload = {
      name:            form.name.trim(),
      description:     form.description.trim()  || null,
      instructions:    form.instructions.trim() || null,
      categories:      form.categories,
      muscle_groups:   form.muscle_groups,
      primary_muscles: form.primary_muscles,
      equipment:       form.equipment,
      video_url:       trimmedVideoUrl || null,
      thumbnail_url:   youTubeThumbnail(trimmedVideoUrl),
    }

    let res: Response
    if (mode === 'edit' && exercise) {
      res = await fetch(`/api/exercises/${exercise.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      res = await fetch('/api/exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }

    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(data.error ?? 'Noe gikk galt')
      return
    }

    onSaved(data as ExerciseRow)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">{TITLES[mode]}</h2>
            {mode === 'copy' && exercise && (
              <p className="text-xs text-gray-400 mt-0.5">Basert på: {exercise.name}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden flex-1">
          <div className="overflow-y-auto px-6 py-5 space-y-5 flex-1">

            {/* ── Name + description ──────────────────────────── */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Øvelsenavn <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="f.eks. Benkpress"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  autoFocus
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Kort beskrivelse</label>
                <input
                  type="text"
                  placeholder="En setning om øvelsen..."
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            </div>

            {/* ── Category ────────────────────────────────────── */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Kategori</label>
              <p className="text-[10px] text-gray-400 mb-2">Velg en eller flere</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(c => (
                  <button
                    key={c} type="button"
                    onClick={() => set('categories', toggle(form.categories, c))}
                    className={`px-3 h-7 rounded-lg text-xs font-semibold transition-all ${
                      form.categories.includes(c)
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Main muscle groups ───────────────────────────── */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Hovedmuskelgruppe</label>
              <p className="text-[10px] text-gray-400 mb-2">Velg alle relevante muskelgrupper</p>
              <div className="flex flex-wrap gap-2">
                {MUSCLE_GROUPS.map(m => (
                  <button
                    key={m} type="button"
                    onClick={() => set('muscle_groups', toggle(form.muscle_groups, m))}
                    className={`px-3 h-7 rounded-lg text-xs font-semibold transition-all ${
                      form.muscle_groups.includes(m)
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Primary muscles ─────────────────────────────── */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Primære muskler</label>
              <p className="text-[10px] text-gray-400 mb-2">Spesifikke muskler som aktiveres</p>
              <div className="flex flex-wrap gap-1.5">
                {PRIMARY_MUSCLES.map(m => (
                  <button
                    key={m} type="button"
                    onClick={() => set('primary_muscles', toggle(form.primary_muscles, m))}
                    className={`px-2.5 h-6 rounded-lg text-[10px] font-semibold transition-all ${
                      form.primary_muscles.includes(m)
                        ? 'bg-[#2d8653] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Equipment ───────────────────────────────────── */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">Utstyr</label>
              <div className="flex flex-wrap gap-2">
                {EQUIPMENT.map(eq => (
                  <button
                    key={eq} type="button"
                    onClick={() => set('equipment', toggle(form.equipment, eq))}
                    className={`px-3 h-7 rounded-lg text-xs font-semibold transition-all ${
                      form.equipment.includes(eq)
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {eq}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Instructions ────────────────────────────────── */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Fremgangsmåte</label>
              <textarea
                rows={4}
                placeholder="Beskriv utførelsen steg for steg..."
                value={form.instructions}
                onChange={e => set('instructions', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
              />
            </div>

            {/* ── Video URL ───────────────────────────────────── */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Videolenke (valgfri)</label>
              <input
                type="url"
                placeholder="https://youtube.com/..."
                value={form.video_url}
                onChange={e => set('video_url', e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              {(() => {
                const preview = youTubeThumbnail(form.video_url.trim())
                return preview && (
                  <a
                    href={form.video_url.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Se video"
                    className="relative mt-2 block w-40 aspect-video rounded-lg overflow-hidden bg-gray-100 group/preview"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="Video-forhåndsvisning" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900/20 group-hover/preview:bg-gray-900/40 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center group-hover/preview:scale-110 transition-transform">
                        <Video className="w-3.5 h-3.5 text-gray-700 translate-x-0.5" />
                      </div>
                    </div>
                  </a>
                )
              })()}
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 rounded-xl"
            >
              Avbryt
            </Button>
            <Button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="flex-1 rounded-xl"
            >
              {saving ? 'Lagrer...' : SAVE_LABELS[mode]}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Trigger button (used by the "Ny øvelse" button) ───────────────────────────

interface TriggerProps {
  onCreated: (exercise: ExerciseRow) => void
}

export function ExerciseFormModal({ onCreated }: TriggerProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm" className="h-9 px-4 rounded-xl">
        <Plus className="w-4 h-4" />
        Ny øvelse
      </Button>
      {open && (
        <ExerciseModal
          mode="create"
          onSaved={onCreated}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
