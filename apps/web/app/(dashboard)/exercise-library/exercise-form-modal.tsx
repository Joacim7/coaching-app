'use client'

import { useState } from 'react'
import { X, Plus, Video, Upload, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { youTubeThumbnail } from '@/lib/video-thumbnail'
import { createClient } from '@/lib/supabase/client'
import { useLocale } from '@/components/locale-provider'
import type { TranslationKey } from '@/lib/i18n/translations'

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
  'Vektskive', 'Step-up boks', 'Stepkasse',
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
  is_standard: boolean
}

function emptyForm(): FormState {
  return {
    name: '', description: '', instructions: '',
    categories: [], muscle_groups: [], primary_muscles: [], equipment: [], video_url: '',
    is_standard: false,
  }
}

function fromExercise(ex: ExerciseRow, mode: FormMode, t: (key: TranslationKey, vars?: Record<string, string | number>) => string): FormState {
  return {
    name:            mode === 'copy' ? t('exerciseLibrary.copySuffix', { name: ex.name }) : ex.name,
    description:     ex.description     ?? '',
    instructions:    ex.instructions    ?? '',
    categories:      ex.categories      ?? [],
    muscle_groups:   ex.muscle_groups   ?? [],
    primary_muscles: ex.primary_muscles ?? [],
    equipment:       ex.equipment       ?? [],
    video_url:       ex.video_url       ?? '',
    // A copy always starts as a personal exercise, even when copying a
    // standard one — only 'create' lets the owner opt into the shared
    // library, and 'edit' never touches this (see handleSubmit).
    is_standard:     mode === 'edit' ? ex.is_standard : false,
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
  isOwner?: boolean
  onSaved: (exercise: ExerciseRow) => void
  onClose: () => void
}

const TITLE_KEYS: Record<FormMode, TranslationKey> = {
  create: 'exerciseLibrary.newExercise',
  edit:   'exerciseLibrary.editExercise',
  copy:   'exerciseLibrary.copyExercise',
}
const SAVE_LABEL_KEYS: Record<FormMode, TranslationKey> = {
  create: 'exerciseLibrary.save',
  edit:   'exerciseLibrary.update',
  copy:   'exerciseLibrary.saveCopy',
}

export function ExerciseModal({ mode, exercise, isOwner = false, onSaved, onClose }: ModalProps) {
  const { t } = useLocale()
  const [form, setForm] = useState<FormState>(() =>
    exercise ? fromExercise(exercise, mode, t) : emptyForm()
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [videoUploadError, setVideoUploadError] = useState('')

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  // Uploads straight into the same `video_url` field the "paste a link"
  // input above uses — no separate URL field for the upload path, so
  // there's only ever one place to look for the exercise's video.
  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return

    setVideoUploadError('')
    setUploadingVideo(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error(t('exerciseLibrary.notLoggedIn'))

      const ext  = file.name.split('.').pop() || 'mp4'
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`

      console.log('[exercise video upload] file:', file.name, '— size:', file.size, `bytes (${(file.size / 1024 / 1024).toFixed(1)} MB)`, '— type:', file.type, '— path:', path)

      const { error: uploadErr } = await supabase.storage
        .from('exercise-videos')
        .upload(path, file, { contentType: file.type, upsert: false })

      if (uploadErr) {
        console.error('[exercise video upload] error:', JSON.stringify(uploadErr), uploadErr)
        throw uploadErr
      }
      console.log('[exercise video upload] success:', path)

      const { data: pub } = supabase.storage.from('exercise-videos').getPublicUrl(path)
      set('video_url', pub.publicUrl)
    } catch (err) {
      setVideoUploadError(err instanceof Error ? err.message : t('exerciseLibrary.uploadFailed'))
    } finally {
      setUploadingVideo(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    setError('')

    const trimmedVideoUrl = form.video_url.trim()

    const payload: Record<string, unknown> = {
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

    // Only relevant on create — editing never changes an exercise's
    // standard status, it just updates the standard exercise in place.
    if (mode === 'create' && isOwner) {
      payload.is_standard = form.is_standard
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
      setError(data.error ?? t('common.somethingWentWrong'))
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
            <h2 className="text-base font-bold text-gray-900">{t(TITLE_KEYS[mode])}</h2>
            {mode === 'copy' && exercise && (
              <p className="text-xs text-gray-400 mt-0.5">{t('exerciseLibrary.basedOn', { name: exercise.name })}</p>
            )}
            {mode === 'edit' && exercise?.is_standard && (
              <p className="text-xs text-amber-600 mt-0.5">{t('exerciseLibrary.editingStandardNote')}</p>
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
                  {t('exerciseLibrary.exerciseName')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('exerciseLibrary.namePlaceholder')}
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  autoFocus
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('exerciseLibrary.shortDescription')}</label>
                <input
                  type="text"
                  placeholder={t('exerciseLibrary.shortDescPlaceholder')}
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            </div>

            {/* ── Standard exercise toggle (owner, create only) ── */}
            {mode === 'create' && isOwner && (
              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_standard}
                  onChange={e => set('is_standard', e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300"
                />
                <span>
                  <span className="block text-xs font-semibold text-gray-700">
                    {t('exerciseLibrary.markAsStandard')}
                  </span>
                  <span className="block text-[10px] text-gray-400">
                    {t('exerciseLibrary.markAsStandardHint')}
                  </span>
                </span>
              </label>
            )}

            {/* ── Category ────────────────────────────────────── */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">{t('exerciseLibrary.category')}</label>
              <p className="text-[10px] text-gray-400 mb-2">{t('exerciseLibrary.chooseOneOrMore')}</p>
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
              <label className="block text-xs font-semibold text-gray-700 mb-1">{t('exerciseLibrary.mainMuscleGroup')}</label>
              <p className="text-[10px] text-gray-400 mb-2">{t('exerciseLibrary.chooseAllRelevant')}</p>
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
              <label className="block text-xs font-semibold text-gray-700 mb-1">{t('exerciseLibrary.primaryMuscles')}</label>
              <p className="text-[10px] text-gray-400 mb-2">{t('exerciseLibrary.specificMusclesActivated')}</p>
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
              <label className="block text-xs font-semibold text-gray-700 mb-2">{t('exerciseLibrary.equipment')}</label>
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
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('exerciseLibrary.method')}</label>
              <textarea
                rows={4}
                placeholder={t('exerciseLibrary.methodPlaceholder')}
                value={form.instructions}
                onChange={e => set('instructions', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
              />
            </div>

            {/* ── Video ─────────────────────────────────────────── */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('exerciseLibrary.videoOptional')}</label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  placeholder="https://youtube.com/..."
                  value={form.video_url}
                  onChange={e => set('video_url', e.target.value)}
                  className="flex-1 h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <label className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors flex-shrink-0">
                  {uploadingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploadingVideo ? t('exerciseLibrary.uploading') : t('exerciseLibrary.uploadVideo')}
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={handleVideoUpload}
                    disabled={uploadingVideo}
                  />
                </label>
              </div>

              {videoUploadError && <p className="text-xs text-red-600 mt-1.5">{videoUploadError}</p>}

              {(() => {
                const url = form.video_url.trim()
                if (!url) return null
                const preview = youTubeThumbnail(url)
                return (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={t('exerciseLibrary.watchVideo')}
                    className="relative mt-2 block w-40 aspect-video rounded-lg overflow-hidden bg-gray-100 group/preview"
                  >
                    {preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={preview} alt={t('exerciseLibrary.videoPreview')} className="w-full h-full object-cover" />
                    ) : (
                      // No YouTube thumbnail — a directly uploaded video file,
                      // so show its first frame natively instead of a plain
                      // "se video" link/button.
                      <video src={url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                    )}
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
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="flex-1 rounded-xl"
            >
              {saving ? t('common.saving') : t(SAVE_LABEL_KEYS[mode])}
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
  isOwner?: boolean
}

export function ExerciseFormModal({ onCreated, isOwner = false }: TriggerProps) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm" className="h-9 px-4 rounded-xl">
        <Plus className="w-4 h-4" />
        {t('exerciseLibrary.newExercise')}
      </Button>
      {open && (
        <ExerciseModal
          mode="create"
          isOwner={isOwner}
          onSaved={onCreated}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
