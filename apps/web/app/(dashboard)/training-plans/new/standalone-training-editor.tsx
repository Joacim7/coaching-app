'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import {
  Plus, Trash2, Save, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, UserPlus, X, Search, Dumbbell, Activity, Pencil, Video, Link2, Flame, Snowflake,
} from 'lucide-react'
import Link from 'next/link'
import type { ExerciseRow } from '@/app/(dashboard)/exercise-library/exercise-form-modal'
import { exerciseThumbnail } from '@/lib/video-thumbnail'

// ── Types ─────────────────────────────────────────────────────────────────────

type SessionType = 'styrke' | 'cardio'

// Named sub-sections within a single styrke day (e.g. "Oppvarming" then
// "Styrke" then "Cardio" then "Nedkjøling"). Stored as a plain tag on each
// exercise rather than a nested structure, so the persisted `exercises`
// array stays flat and mobile (which just renders that array in order)
// keeps working unchanged — sections are a web-editor-only grouping layer.
type SubSectionType = 'oppvarming' | 'styrke' | 'cardio' | 'nedkjøling'

const SUBSECTION_TYPES: SubSectionType[] = ['oppvarming', 'styrke', 'cardio', 'nedkjøling']

const SUBSECTION_LABELS: Record<SubSectionType, string> = {
  oppvarming: 'Oppvarming',
  styrke: 'Styrke',
  cardio: 'Cardio',
  nedkjøling: 'Nedkjøling',
}

const SUBSECTION_ICONS: Record<SubSectionType, React.ReactNode> = {
  oppvarming: <Flame className="w-3.5 h-3.5" />,
  styrke: <Dumbbell className="w-3.5 h-3.5" />,
  cardio: <Activity className="w-3.5 h-3.5" />,
  nedkjøling: <Snowflake className="w-3.5 h-3.5" />,
}

type SessionExercise = {
  id: string
  exercise_id?: string
  name: string
  sets: number
  reps: string
  weight: string
  rest: string
  rir?: string
  tempo?: string
  notes: string
  thumbnail_url?: string | null
  video_url?: string | null
  muscle_groups?: string[]
  group_id?: string | null // shared id links exercises into a superset
  section?: SubSectionType | null // which sub-section this exercise belongs to, if any
  // When set, this entry represents a Cardio sub-section's settings (from
  // the "Legg til kardio" modal) rather than a trackable strength exercise —
  // the section's content renders a config summary instead of exercise rows.
  cardioConfig?: CardioConfig
}

type CardioConfig = {
  activity_type: string
  cardio_mode: 'kontinuerlig' | 'intervaller'
  duration_min: string
  distance_km: string
  heart_rate_zone: string
  notes: string
}

type Session = {
  id: string
  day_of_week: number
  title: string
  type: SessionType
  exercises: SessionExercise[]
  cardio_config: CardioConfig | null
  // Ordered display slots for this day — `null` is the default/unsectioned
  // group of exercises (always present exactly once, no header of its own)
  // and everything else is a named sub-section. Keeping the unsectioned
  // group IN this array (instead of always rendering it first) is what
  // lets a named section like "Oppvarming" move above it. Derived from
  // exercises' `section` tags on load (see the initial state below) — an
  // empty sub-section with no exercises yet only survives for the rest of
  // the current editing session, not a reload, since there's nothing to
  // tag it with in storage.
  sections: (SubSectionType | null)[]
}

interface Props {
  clientId: string | null
  clientName: string | null
  coachId: string
  clients: { id: string; name: string }[]
  exercises: ExerciseRow[]
  initialPlan: {
    id: string
    title: string
    description: string | null
    sessions: Array<{
      id: string
      day_of_week: number
      title: string
      session_type?: string | null
      exercises: unknown[]
    }>
  } | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']

const MUSCLE_PILLS = ['Alle', 'Bryst', 'Rygg', 'Skuldre', 'Biceps', 'Triceps', 'Mage', 'Ben', 'Sete']

const MUSCLE_COLORS: Record<string, string> = {
  Bryst: 'bg-pink-100 text-pink-700',
  Rygg: 'bg-emerald-100 text-emerald-700',
  Skuldre: 'bg-violet-100 text-violet-700',
  Armer: 'bg-orange-100 text-orange-700',
  Bein: 'bg-red-100 text-red-700',
  'Mage/Core': 'bg-teal-100 text-teal-700',
  Ben: 'bg-red-100 text-red-700',
  Sete: 'bg-amber-100 text-amber-700',
}

const ACTIVITY_TYPES = ['Løping', 'Sykling', 'Svømming', 'Roing', 'Gange', 'Ellipse', 'Annet']

const HEART_RATE_ZONES = [
  { value: 'Sone 1', label: 'Sone 1 (50-60% - Lett)' },
  { value: 'Sone 2', label: 'Sone 2 (60-70% - Moderat)' },
  { value: 'Sone 3', label: 'Sone 3 (70-80% - Aerob)' },
  { value: 'Sone 4', label: 'Sone 4 (80-90% - Terskel)' },
  { value: 'Sone 5', label: 'Sone 5 (90-100% - Maksimal)' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function newExercise(from?: ExerciseRow): SessionExercise {
  return {
    id: crypto.randomUUID(),
    exercise_id: from?.id,
    name: from?.name ?? '',
    sets: 3,
    reps: '8–10',
    weight: '',
    rest: '60s',
    rir: '',
    tempo: '',
    notes: '',
    thumbnail_url: from?.thumbnail_url,
    video_url: from?.video_url,
    muscle_groups: from?.muscle_groups,
  }
}

function defaultCardioConfig(): CardioConfig {
  return {
    activity_type: 'Løping',
    cardio_mode: 'kontinuerlig',
    duration_min: '',
    distance_km: '',
    heart_rate_zone: '',
    notes: '',
  }
}

function newSession(dayNum: number, type: SessionType = 'styrke'): Session {
  return {
    id: crypto.randomUUID(),
    day_of_week: dayNum,
    title: DAYS[dayNum - 1],
    type,
    exercises: [],
    cardio_config: null,
    sections: [null],
  }
}

// A superset only makes sense with 2+ linked exercises — if a mutation
// (remove/reorder) leaves a group with a single member, dissolve it instead
// of leaving an orphaned group_id around.
function withGroupCleanup(list: SessionExercise[]): SessionExercise[] {
  const counts = new Map<string, number>()
  for (const e of list) {
    if (e.group_id) counts.set(e.group_id, (counts.get(e.group_id) ?? 0) + 1)
  }
  return list.map(e => (e.group_id && (counts.get(e.group_id) ?? 0) < 2) ? { ...e, group_id: undefined } : e)
}

// Supersets render as a contiguous block, so once exercises are linked they
// need to sit next to each other in the list — this moves every member of
// `groupId` together, inserted where the earliest member used to sit.
function reorderGroupContiguous(list: SessionExercise[], groupId: string): SessionExercise[] {
  const members = list.filter(e => e.group_id === groupId)
  if (members.length < 2) return list
  const firstIdx = list.findIndex(e => e.group_id === groupId)
  const others = list.filter(e => e.group_id !== groupId)
  const insertAt = list.slice(0, firstIdx).filter(e => e.group_id !== groupId).length
  const result = [...others]
  result.splice(insertAt, 0, ...members)
  return result
}

// Recomputes exId's superset membership so it matches `partnerIds` exactly:
// exercises added to partnerIds join exId's group (leaving whatever group
// they were in before), exercises removed leave it. Reuses exId's existing
// group_id when it has one so the group's identity/letter stays stable.
function applySupersetSelection(
  exercises: SessionExercise[],
  exId: string,
  partnerIds: Set<string>
): SessionExercise[] {
  const cur = exercises.find(e => e.id === exId)
  if (!cur) return exercises

  const oldGroupId = cur.group_id
  const memberIds = new Set([exId, ...partnerIds])
  const groupId = memberIds.size >= 2 ? (oldGroupId ?? crypto.randomUUID()) : undefined

  let next = exercises.map(e => {
    if (memberIds.has(e.id)) return { ...e, group_id: groupId }
    if (oldGroupId && e.group_id === oldGroupId) return { ...e, group_id: undefined }
    return e
  })

  next = withGroupCleanup(next)
  if (groupId) next = reorderGroupContiguous(next, groupId)
  return next
}

type ExerciseBlock =
  | { type: 'single'; ex: SessionExercise }
  | { type: 'group'; label: string; exs: SessionExercise[] }

// Groups contiguous runs of exercises sharing a group_id into "superset"
// blocks for rendering, assigning each distinct group a display letter in
// order of first appearance.
function buildExerciseBlocks(exercises: SessionExercise[]): ExerciseBlock[] {
  const blocks: ExerciseBlock[] = []
  const labelFor = new Map<string, string>()
  let i = 0
  while (i < exercises.length) {
    const ex = exercises[i]
    if (ex.group_id) {
      const groupExs = [ex]
      let j = i + 1
      while (j < exercises.length && exercises[j].group_id === ex.group_id) {
        groupExs.push(exercises[j])
        j++
      }
      if (!labelFor.has(ex.group_id)) {
        labelFor.set(ex.group_id, String.fromCharCode(65 + labelFor.size % 26))
      }
      blocks.push({ type: 'group', label: labelFor.get(ex.group_id)!, exs: groupExs })
      i = j
    } else {
      blocks.push({ type: 'single', ex })
      i++
    }
  }
  return blocks
}

function exerciseMatchesMuscle(ex: ExerciseRow, filter: string): boolean {
  const muscles = [...(ex.muscle_groups ?? []), ...(ex.primary_muscles ?? [])].map(m => m.toLowerCase())
  const name = ex.name.toLowerCase()
  const desc = (ex.description ?? '').toLowerCase()
  switch (filter) {
    case 'Alle':     return true
    case 'Bryst':    return muscles.some(m => m.includes('bryst'))
    case 'Rygg':     return muscles.some(m => m.includes('rygg'))
    case 'Skuldre':  return muscles.some(m => m.includes('skull'))
    case 'Biceps':   return muscles.some(m => m.includes('arm')) && (name.includes('curl') || name.includes('bicep') || desc.includes('bicep'))
    case 'Triceps':  return muscles.some(m => m.includes('arm')) && (name.includes('tricep') || name.includes('triser') || desc.includes('tricep'))
    case 'Mage':     return muscles.some(m => m.includes('mage') || m.includes('core'))
    case 'Ben':      return muscles.some(m => m.includes('bein') || m.includes('ben'))
    case 'Sete':     return muscles.some(m => m.includes('sete') || m.includes('glute')) || name.includes('sete')
    default: return true
  }
}

// ── Shared form parts ─────────────────────────────────────────────────────────

function labelClass() {
  return 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5'
}

function inputClass() {
  return 'w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6ecfb0] focus:border-[#6ecfb0] bg-white'
}

function selectClass() {
  return 'w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6ecfb0] focus:border-[#6ecfb0] bg-white appearance-none'
}

// ── CardioForm ────────────────────────────────────────────────────────────────

function CardioForm({
  config,
  onChange,
}: {
  config: CardioConfig
  onChange: (updates: Partial<CardioConfig>) => void
}) {
  return (
    <div className="space-y-4">
      {/* Type */}
      <div>
        <label className={labelClass()}>Type</label>
        <select
          value={config.activity_type}
          onChange={e => onChange({ activity_type: e.target.value })}
          className={selectClass()}
        >
          {ACTIVITY_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      {/* Kardio type toggle */}
      <div>
        <label className={labelClass()}>Kardio type</label>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {(['kontinuerlig', 'intervaller'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => onChange({ cardio_mode: mode })}
              className={`flex-1 py-2 text-sm font-semibold transition-colors capitalize ${
                config.cardio_mode === mode
                  ? 'bg-[#1a5c3a] text-white'
                  : 'bg-white text-gray-500 hover:bg-[#ebf5ef] hover:text-[#1a5c3a]'
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Varighet + Distanse */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass()}>Varighet (min)</label>
          <input
            type="text"
            inputMode="numeric"
            value={config.duration_min}
            onChange={e => onChange({ duration_min: e.target.value })}
            placeholder="45"
            className={inputClass()}
          />
        </div>
        <div>
          <label className={labelClass()}>Distanse (km)</label>
          <input
            type="text"
            inputMode="decimal"
            value={config.distance_km}
            onChange={e => onChange({ distance_km: e.target.value })}
            placeholder="5"
            className={inputClass()}
          />
        </div>
      </div>

      {/* Pulssone */}
      <div>
        <label className={labelClass()}>Pulssone</label>
        <select
          value={config.heart_rate_zone}
          onChange={e => onChange({ heart_rate_zone: e.target.value })}
          className={selectClass()}
        >
          <option value="">Velg pulssone...</option>
          {HEART_RATE_ZONES.map(z => (
            <option key={z.value} value={z.value}>{z.label}</option>
          ))}
        </select>
      </div>

      {/* Notater */}
      <div>
        <label className={labelClass()}>Notater</label>
        <textarea
          value={config.notes}
          onChange={e => onChange({ notes: e.target.value })}
          placeholder="F.eks. fokus på jevnt tempo, hold puls under 150..."
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6ecfb0] focus:border-[#6ecfb0] resize-none bg-white placeholder:text-gray-300"
        />
      </div>
    </div>
  )
}

// ── SessionTypeModal ──────────────────────────────────────────────────────────

function SessionTypeModal({ onSelectStrength, onSelectCardio, onClose }: {
  onSelectStrength: () => void
  onSelectCardio: () => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Velg økttype</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onSelectStrength}
            className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-gray-100 hover:border-[#6ecfb0] hover:bg-[#ebf5ef] transition-all group"
          >
            <div className="w-12 h-12 rounded-full bg-[#ebf5ef] group-hover:bg-white flex items-center justify-center transition-colors">
              <Dumbbell className="w-6 h-6 text-[#1a5c3a]" />
            </div>
            <div className="text-center">
              <p className="font-bold text-gray-800">Styrkeøkt</p>
              <p className="text-xs text-gray-400 mt-0.5">Sett, reps, vekt</p>
            </div>
          </button>

          <button
            onClick={onSelectCardio}
            className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-gray-100 hover:border-[#6ecfb0] hover:bg-[#ebf5ef] transition-all group"
          >
            <div className="w-12 h-12 rounded-full bg-[#ebf5ef] group-hover:bg-white flex items-center justify-center transition-colors">
              <Activity className="w-6 h-6 text-[#1a5c3a]" />
            </div>
            <div className="text-center">
              <p className="font-bold text-gray-800">Cardio-økt</p>
              <p className="text-xs text-gray-400 mt-0.5">Intervall, tid, puls</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── CardioSessionModal ────────────────────────────────────────────────────────

function CardioSessionModal({ initial, onAdd, onClose }: {
  initial?: CardioConfig
  onAdd: (config: CardioConfig) => void
  onClose: () => void
}) {
  const [config, setConfig] = useState<CardioConfig>(initial ?? defaultCardioConfig())

  function update(updates: Partial<CardioConfig>) {
    setConfig(prev => ({ ...prev, ...updates }))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#ebf5ef] flex items-center justify-center">
              <Activity className="w-4 h-4 text-[#1a5c3a]" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">{initial ? 'Rediger kardio' : 'Legg til kardio'}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <CardioForm config={config} onChange={update} />

        {/* Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:border-gray-300 transition-colors"
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={() => onAdd(config)}
            className="flex-1 h-10 rounded-lg bg-gradient-to-r from-[#1a5c3a] to-[#6ecfb0] text-white text-sm font-bold hover:opacity-90 transition-opacity"
          >
            {initial ? 'Lagre' : 'Legg til'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ExerciseCard ──────────────────────────────────────────────────────────────

function ExerciseCard({ ex, onAdd, onDragStart }: {
  ex: ExerciseRow
  onAdd: () => void
  onDragStart: () => void
}) {
  const primaryMuscle = ex.muscle_groups[0] ?? 'Annet'
  const colorClass = MUSCLE_COLORS[primaryMuscle] ?? 'bg-gray-100 text-gray-600'
  const thumb = exerciseThumbnail(ex)

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('exercise_id', ex.id)
    e.dataTransfer.effectAllowed = 'copy'
    onDragStart()
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="group relative bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md hover:border-[#6ecfb0] transition-all cursor-grab active:cursor-grabbing"
    >
      <div className="h-24 relative bg-gradient-to-br from-[#ebf5ef] to-[#cdeee3] flex items-center justify-center">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={ex.name} className="w-full h-full object-cover" />
        ) : ex.video_url ? (
          // No YouTube/stored thumbnail — this is a directly uploaded video
          // file, so show its first frame natively instead of a bare icon.
          <video src={ex.video_url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
        ) : (
          <Dumbbell className="w-8 h-8 text-[#6ecfb0]" />
        )}
        {ex.video_url && (
          <a
            href={ex.video_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            draggable={false}
            title="Se video"
            className="absolute inset-0 flex items-center justify-center group/thumb"
          >
            <div className="absolute inset-0 bg-gray-900/0 group-hover/thumb:bg-gray-900/20 transition-colors" />
            <div className="relative w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 group-hover/thumb:scale-110 transition-all">
              <Video className="w-3.5 h-3.5 text-gray-700 translate-x-0.5" />
            </div>
          </a>
        )}
        <button
          onClick={onAdd}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[#1a5c3a] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-[#2d8653]"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="p-2.5">
        <p className="text-sm font-semibold text-gray-800 leading-tight mb-1.5 line-clamp-2">
          {ex.name}
        </p>
        <div className="flex flex-wrap gap-1">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${colorClass}`}>
            {primaryMuscle}
          </span>
          {ex.equipment.slice(0, 1).map(eq => (
            <span key={eq} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
              {eq}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── SessionExerciseRow ────────────────────────────────────────────────────────

// Anchored to the whole exercise card (not the small "SS" trigger button),
// with a visible gap and its own border/shadow, so it reads as a clearly
// separate floating panel instead of visually fusing with the button.
function SupersetPicker({
  ex,
  sessionExercises,
  onToggleMember,
  onClose,
}: {
  ex: SessionExercise
  sessionExercises: SessionExercise[]
  onToggleMember: (otherId: string) => void
  onClose: () => void
}) {
  // Same-section only — linking across e.g. Oppvarming and Styrke would be
  // an unusual superset and complicates keeping sub-sections coherent.
  const others = sessionExercises.filter(e => e.id !== ex.id && e.section === ex.section)
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute z-20 top-full left-0 mt-2 w-72 bg-white rounded-xl border-2 border-[#6ecfb0] shadow-xl p-2">
        <p className="px-2 py-1.5 text-xs font-bold text-[#1a5c3a]">
          Supersett med {ex.name ? `«${ex.name}»` : 'denne øvelsen'}
        </p>
        {others.length === 0 ? (
          <p className="px-2 py-2 text-sm text-gray-400">Legg til flere øvelser i økten først.</p>
        ) : (
          <div className="max-h-52 overflow-y-auto border-t border-gray-100 mt-1 pt-1">
            {others.map(o => {
              const checked = !!ex.group_id && o.group_id === ex.group_id
              return (
                <label
                  key={o.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#ebf5ef] cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleMember(o.id)}
                    className="accent-[#1a5c3a]"
                  />
                  <span className="truncate text-gray-700">{o.name || 'Uten navn'}</span>
                </label>
              )
            })}
          </div>
        )}
        <button
          onClick={onClose}
          className="mt-1 w-full text-center text-xs font-semibold text-[#1a5c3a] hover:underline py-1"
        >
          Ferdig
        </button>
      </div>
    </>
  )
}

function SessionExerciseRow({
  ex,
  exerciseLibrary,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  groupLabel,
  sessionExercises,
  pickerOpen,
  onOpenPicker,
  onClosePicker,
  onToggleSupersetMember,
}: {
  ex: SessionExercise
  exerciseLibrary: ExerciseRow[]
  onChange: (field: keyof SessionExercise, value: string | number) => void
  onRemove: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  groupLabel?: string
  sessionExercises: SessionExercise[]
  pickerOpen: boolean
  onOpenPicker: () => void
  onClosePicker: () => void
  onToggleSupersetMember: (otherId: string) => void
}) {
  const primaryMuscle = ex.muscle_groups?.[0]
  const colorClass = primaryMuscle ? (MUSCLE_COLORS[primaryMuscle] ?? 'bg-gray-100 text-gray-500') : 'bg-gray-100 text-gray-500'

  // Older sessions were saved before thumbnail_url/video_url existed on the
  // stored exercise snapshot — fall back to the live library entry (matched
  // by exercise_id) so those plans self-heal instead of showing a dumbbell
  // forever even though the exercise itself has a video.
  const libMatch = ex.exercise_id ? exerciseLibrary.find(e => e.id === ex.exercise_id) : undefined
  const videoUrl = ex.video_url ?? libMatch?.video_url ?? null
  const thumb = exerciseThumbnail({ thumbnail_url: ex.thumbnail_url ?? libMatch?.thumbnail_url, video_url: videoUrl })

  return (
    <div className={`relative p-3 bg-white rounded-xl border border-gray-100 group hover:border-[#6ecfb0] transition-colors ${pickerOpen ? 'z-30' : ''}`}>
      {/* Top row: identity + ordering/superset controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => (pickerOpen ? onClosePicker() : onOpenPicker())}
          title={ex.group_id ? 'Endre supersett' : 'Lag supersett med andre øvelser'}
          className={`relative shrink-0 flex items-center justify-center h-6 min-w-[26px] px-1.5 rounded-md text-[10px] font-extrabold tracking-wide transition-colors ${
            ex.group_id
              ? 'bg-[#1a5c3a] text-white'
              : 'bg-gray-100 text-gray-400 hover:bg-[#ebf5ef] hover:text-[#1a5c3a]'
          }`}
        >
          SS
        </button>
        <div className="flex flex-col shrink-0">
          <button
            onClick={onMoveUp}
            disabled={!onMoveUp}
            title="Flytt opp"
            className="w-5 h-4 flex items-center justify-center text-gray-300 hover:text-[#1a5c3a] disabled:opacity-20 disabled:hover:text-gray-300 transition-colors"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={!onMoveDown}
            title="Flytt ned"
            className="w-5 h-4 flex items-center justify-center text-gray-300 hover:text-[#1a5c3a] disabled:opacity-20 disabled:hover:text-gray-300 transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="relative w-10 h-10 rounded-lg bg-gradient-to-br from-[#ebf5ef] to-[#cdeee3] flex items-center justify-center shrink-0 overflow-hidden group/thumb">
          {thumb
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={thumb} alt={ex.name} className="w-full h-full object-cover" />
            : videoUrl
              // No YouTube/stored thumbnail — a directly uploaded video file,
              // so show its first frame natively instead of a bare icon.
              ? <video src={videoUrl} muted playsInline preload="metadata" className="w-full h-full object-cover" />
              : <Dumbbell className="w-4 h-4 text-[#6ecfb0]" />
          }
          {videoUrl && (
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Se video"
              className="absolute inset-0 flex items-center justify-center bg-gray-900/0 hover:bg-gray-900/30 transition-colors"
            >
              <Video className="w-3.5 h-3.5 text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity drop-shadow" />
            </a>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <input
            value={ex.name}
            onChange={e => onChange('name', e.target.value)}
            placeholder="Øvelsesnavn..."
            className="w-full text-sm font-semibold text-gray-800 bg-transparent focus:outline-none placeholder:text-gray-300"
          />
          {(groupLabel || primaryMuscle) && (
            <div className="flex items-center gap-1 mt-0.5">
              {groupLabel && (
                <span className="inline-block text-[10px] font-bold px-1.5 py-0 rounded-full bg-[#1a5c3a] text-white">
                  {groupLabel}
                </span>
              )}
              {primaryMuscle && (
                <span className={`inline-block text-[10px] font-semibold px-1.5 py-0 rounded-full ${colorClass}`}>
                  {primaryMuscle}
                </span>
              )}
            </div>
          )}
        </div>

        <button onClick={onRemove} className="shrink-0 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom row: training parameters */}
      <div className="flex items-center flex-wrap gap-3 mt-3 pt-3 border-t border-gray-50">
        {/* Sett */}
        <div className="text-center shrink-0">
          <p className="text-[10px] text-gray-400 mb-0.5">Sett</p>
          <div className="flex items-center gap-1">
            <button onClick={() => onChange('sets', Math.max(1, ex.sets - 1))} className="w-5 h-5 rounded bg-gray-100 text-gray-500 hover:bg-[#ebf5ef] hover:text-[#1a5c3a] text-xs flex items-center justify-center">−</button>
            <span className="w-5 text-center text-sm font-bold text-gray-700">{ex.sets}</span>
            <button onClick={() => onChange('sets', ex.sets + 1)} className="w-5 h-5 rounded bg-gray-100 text-gray-500 hover:bg-[#ebf5ef] hover:text-[#1a5c3a] text-xs flex items-center justify-center">+</button>
          </div>
        </div>

        {/* Reps */}
        <div className="text-center shrink-0">
          <p className="text-[10px] text-gray-400 mb-0.5">Reps</p>
          <input value={ex.reps} onChange={e => onChange('reps', e.target.value)} className="w-14 text-sm font-semibold text-center border border-gray-200 rounded-lg px-1.5 py-1 focus:outline-none focus:border-[#6ecfb0]" placeholder="8–10" />
        </div>

        {/* Vekt */}
        <div className="text-center shrink-0">
          <p className="text-[10px] text-gray-400 mb-0.5">Vekt</p>
          <input value={ex.weight} onChange={e => onChange('weight', e.target.value)} className="w-14 text-sm font-semibold text-center border border-gray-200 rounded-lg px-1.5 py-1 focus:outline-none focus:border-[#6ecfb0]" placeholder="kg" />
        </div>

        {/* Pause */}
        <div className="text-center shrink-0">
          <p className="text-[10px] text-gray-400 mb-0.5">Pause</p>
          <input value={ex.rest} onChange={e => onChange('rest', e.target.value)} className="w-14 text-sm font-semibold text-center border border-gray-200 rounded-lg px-1.5 py-1 focus:outline-none focus:border-[#6ecfb0]" placeholder="60s" />
        </div>

        {/* RIR */}
        <div className="text-center shrink-0">
          <p className="text-[10px] text-gray-400 mb-0.5">RIR</p>
          <input value={ex.rir ?? ''} onChange={e => onChange('rir', e.target.value)} className="w-12 text-sm font-semibold text-center border border-gray-200 rounded-lg px-1.5 py-1 focus:outline-none focus:border-[#6ecfb0]" placeholder="2" />
        </div>

        {/* Tempo */}
        <div className="text-center shrink-0">
          <p className="text-[10px] text-gray-400 mb-0.5">Tempo</p>
          <input value={ex.tempo ?? ''} onChange={e => onChange('tempo', e.target.value)} className="w-14 text-sm font-semibold text-center border border-gray-200 rounded-lg px-1.5 py-1 focus:outline-none focus:border-[#6ecfb0]" placeholder="30X1" />
        </div>

        {/* Notes */}
        <div className="text-left flex-1 min-w-[140px]">
          <p className="text-[10px] text-gray-400 mb-0.5">Notater</p>
          <input value={ex.notes} onChange={e => onChange('notes', e.target.value)} placeholder="Notater..." className="w-full text-xs text-gray-600 border border-gray-200 rounded-lg px-1.5 py-1 focus:outline-none focus:border-[#6ecfb0] placeholder:text-gray-300" />
        </div>
      </div>

      {pickerOpen && (
        <SupersetPicker
          ex={ex}
          sessionExercises={sessionExercises}
          onToggleMember={onToggleSupersetMember}
          onClose={onClosePicker}
        />
      )}
    </div>
  )
}

// ── SubSectionAdder ───────────────────────────────────────────────────────────

function SubSectionAdder({ existing, onAdd }: {
  existing: SubSectionType[]
  onAdd: (type: SubSectionType) => void
}) {
  const [open, setOpen] = useState(false)
  const available = SUBSECTION_TYPES.filter(t => !existing.includes(t))
  if (available.length === 0) return null

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-[#1a5c3a] hover:bg-[#ebf5ef] border border-dashed border-gray-200 hover:border-[#6ecfb0] transition-colors"
      >
        <Plus className="w-4 h-4" />
        Legg til økt
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          {/* Opens upward — this button always sits at the very bottom of a
              (potentially long, scrollable) section list, so a downward
              menu can render below the visible scroll area and get clipped
              by the pane's overflow-y-auto, making its items unclickable
              even though the trigger button itself works fine. */}
          <div className="absolute z-20 bottom-full left-0 mb-1 w-48 bg-white rounded-xl border border-gray-200 shadow-lg p-1.5">
            {available.map(t => (
              <button
                key={t}
                onClick={() => { onAdd(t); setOpen(false) }}
                className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-[#ebf5ef] hover:text-[#1a5c3a] transition-colors"
              >
                {SUBSECTION_ICONS[t]}
                {SUBSECTION_LABELS[t]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Main editor ───────────────────────────────────────────────────────────────

export default function StandaloneTrainingPlanEditor({
  clientId, clientName, coachId, clients, exercises, initialPlan,
}: Props) {
  const supabase = createClient()
  const router = useRouter()

  const [title, setTitle]     = useState(initialPlan?.title ?? 'Ny treningsplan')
  const [isDraft, setIsDraft] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [savedTemplate, setSavedTemplate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting]     = useState(false)

  const [sessions, setSessions] = useState<Session[]>(
    (initialPlan?.sessions ?? [])
      .sort((a, b) => a.day_of_week - b.day_of_week)
      .map(s => {
        const firstEx = Array.isArray(s.exercises) && s.exercises.length > 0 ? s.exercises[0] : null
        const hasCardioConfig = firstEx && typeof firstEx === 'object' && 'activity_type' in (firstEx as object)
        // Falls back to the shape check, not just the DB column: every
        // session saved before this fix has session_type stuck at 'styrke'
        // regardless of its real type (buildSessionRows never wrote it) —
        // this lets already-corrupted rows still load correctly.
        const isCardio = s.session_type === 'cardio' || !!hasCardioConfig
        console.log('[standalone-training-editor] load session', s.id, s.title, '— session_type:', s.session_type, 'hasCardioConfig:', hasCardioConfig, '→ isCardio:', isCardio)
        const loadedExercises = isCardio ? [] : (s.exercises as SessionExercise[])
        // Ordered-unique list of section slots (including the unsectioned
        // group as `null`) in order of first appearance in the saved
        // exercises array. moveSubSection physically reorders that array to
        // match the display order (see below), so this correctly
        // reconstructs whatever order the coach last set — e.g. Oppvarming
        // moved above Styrke stays above Styrke after a reload.
        const sections: (SubSectionType | null)[] = []
        for (const ex of loadedExercises) {
          const key = ex.section ?? null
          if (!sections.includes(key)) sections.push(key)
        }
        if (!sections.includes(null)) sections.push(null)
        return {
          id: s.id,
          day_of_week: s.day_of_week,
          title: s.title,
          type: isCardio ? 'cardio' : 'styrke',
          exercises: loadedExercises,
          cardio_config: isCardio && hasCardioConfig ? (firstEx as CardioConfig) : null,
          sections,
        }
      })
  )
  const [activeDay, setActiveDay] = useState<number | null>(
    initialPlan?.sessions?.[0]?.day_of_week ?? null
  )

  const [showTypeModal, setShowTypeModal]   = useState(false)
  const [showCardioModal, setShowCardioModal] = useState(false)
  // Day a Cardio *sub-section*'s "Legg til kardio" modal is open for (null
  // when closed) — separate from showCardioModal above, which is for
  // creating a whole cardio-type session, not a sub-section within a
  // styrkeøkt.
  const [cardioSubSectionDay, setCardioSubSectionDay] = useState<number | null>(null)
  const [supersetPickerFor, setSupersetPickerFor] = useState<string | null>(null)

  const [assignOpen, setAssignOpen]         = useState(false)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [assignQuery, setAssignQuery]       = useState('')
  const [assigning, setAssigning]           = useState(false)

  const [libSearch, setLibSearch]   = useState('')
  const [libTab, setLibTab]         = useState<'alle' | 'standard' | 'mine'>('alle')
  const [musclePill, setMusclePill] = useState('Alle')
  // Which drop zone is currently hovered during a drag — 'unsectioned' or a
  // SubSectionType — since a styrke day can now have several drop zones.
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const dragExRef = useRef<ExerciseRow | null>(null)

  // ── Library filtering ────────────────────────────────────────────────────

  const filteredExercises = useMemo(() => {
    let base = exercises
    if (libTab === 'standard') base = base.filter(e => e.is_standard)
    if (libTab === 'mine')     base = base.filter(e => !e.is_standard)
    if (musclePill !== 'Alle') base = base.filter(e => exerciseMatchesMuscle(e, musclePill))
    const q = libSearch.trim().toLowerCase()
    if (q) base = base.filter(e => e.name.toLowerCase().includes(q) || (e.description ?? '').toLowerCase().includes(q))
    return base
  }, [exercises, libTab, musclePill, libSearch])

  // ── Session mutations ────────────────────────────────────────────────────

  function addStrengthSession() {
    const usedDays = new Set(sessions.map(s => s.day_of_week))
    const nextDay = [1,2,3,4,5,6,7].find(d => !usedDays.has(d))
    if (!nextDay) return
    const s = newSession(nextDay, 'styrke')
    setSessions(prev => [...prev, s].sort((a, b) => a.day_of_week - b.day_of_week))
    setActiveDay(nextDay)
    setShowTypeModal(false)
  }

  function addCardioSession(config: CardioConfig) {
    const usedDays = new Set(sessions.map(s => s.day_of_week))
    const nextDay = [1,2,3,4,5,6,7].find(d => !usedDays.has(d))
    if (!nextDay) return
    const s: Session = {
      id: crypto.randomUUID(),
      day_of_week: nextDay,
      title: config.activity_type,
      type: 'cardio',
      exercises: [],
      cardio_config: config,
      sections: [null],
    }
    setSessions(prev => [...prev, s].sort((a, b) => a.day_of_week - b.day_of_week))
    setActiveDay(nextDay)
    setShowCardioModal(false)
  }

  const removeSession = useCallback((dayNum: number) => {
    setSessions(prev => prev.filter(s => s.day_of_week !== dayNum))
    setActiveDay(prev => prev === dayNum ? null : prev)
  }, [])

  // Reorders session tabs by swapping day_of_week with the adjacent session
  // in sorted order (mirrors the exercise up/down pattern) — a session's
  // own title/exercises move with it, only its position changes.
  const moveSession = useCallback((dayNum: number, direction: -1 | 1) => {
    let otherDay: number | null = null
    setSessions(prev => {
      const sorted = [...prev].sort((a, b) => a.day_of_week - b.day_of_week)
      const idx = sorted.findIndex(s => s.day_of_week === dayNum)
      const swapIdx = idx + direction
      if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) return prev
      otherDay = sorted[swapIdx].day_of_week
      // Keep the `sessions` array itself sorted by day_of_week (every other
      // mutation preserves that invariant) so tab order and index-based
      // boundary checks stay correct.
      return prev
        .map(s => {
          if (s.day_of_week === dayNum) return { ...s, day_of_week: otherDay! }
          if (s.day_of_week === otherDay) return { ...s, day_of_week: dayNum }
          return s
        })
        .sort((a, b) => a.day_of_week - b.day_of_week)
    })
    setActiveDay(prevActive => {
      if (otherDay == null) return prevActive
      if (prevActive === dayNum) return otherDay
      if (prevActive === otherDay) return dayNum
      return prevActive
    })
  }, [])

  const updateSession = useCallback((dayNum: number, field: 'title', value: string) => {
    setSessions(prev => prev.map(s => s.day_of_week === dayNum ? { ...s, [field]: value } : s))
  }, [])

  const addExerciseToSession = useCallback((dayNum: number, from?: ExerciseRow, section?: SubSectionType) => {
    setSessions(prev =>
      prev.map(s =>
        s.day_of_week === dayNum
          ? { ...s, exercises: [...s.exercises, { ...newExercise(from), section }] }
          : s
      )
    )
  }, [])

  // Adds a named sub-section header to a day (no-op if it's already there).
  const addSubSection = useCallback((dayNum: number, type: SubSectionType) => {
    setSessions(prev =>
      prev.map(s =>
        s.day_of_week === dayNum && !s.sections.includes(type)
          ? { ...s, sections: [...s.sections, type] }
          : s
      )
    )
  }, [])

  // Saves (or updates) the Cardio sub-section's config — adds 'cardio' to
  // sections if it isn't there yet, and replaces any previous cardioConfig
  // entry with the new one (there's only ever at most one per day).
  const saveCardioSubSection = useCallback((dayNum: number, config: CardioConfig) => {
    setSessions(prev =>
      prev.map(s => {
        if (s.day_of_week !== dayNum) return s
        const sections: (SubSectionType | null)[] = s.sections.includes('cardio') ? s.sections : [...s.sections, 'cardio']
        const withoutOldCardio = s.exercises.filter(e => !(e.section === 'cardio' && e.cardioConfig))
        const cardioEntry: SessionExercise = {
          id: crypto.randomUUID(),
          name: config.activity_type,
          sets: 0,
          reps: '',
          weight: '',
          rest: '',
          notes: config.notes,
          section: 'cardio',
          cardioConfig: config,
        }
        return { ...s, sections, exercises: [...withoutOldCardio, cardioEntry] }
      })
    )
  }, [])

  // Removing a sub-section un-tags its exercises (back to the unsectioned
  // group) rather than deleting them — except Cardio, whose single
  // cardioConfig entry isn't a real exercise and would just sit in the
  // general pool as a blank, nameless row, so that one's discarded outright.
  const removeSubSection = useCallback((dayNum: number, type: SubSectionType) => {
    setSessions(prev =>
      prev.map(s =>
        s.day_of_week === dayNum
          ? {
              ...s,
              sections: s.sections.filter(t => t !== type),
              exercises: type === 'cardio'
                ? s.exercises.filter(e => !(e.section === 'cardio' && e.cardioConfig))
                : s.exercises.map(e => e.section === type ? { ...e, section: undefined } : e),
            }
          : s
      )
    )
  }, [])

  // Reorders the sub-section headers themselves (e.g. move Oppvarming above
  // Styrke). Also physically reorders the underlying exercises array to
  // match — the section order isn't stored separately, it's reconstructed
  // on load from which section's exercises appear first in that array (see
  // the initial state above), so without this the reorder would look right
  // in the current session but silently revert on the next save+reload.
  // This is also what makes the client-facing app show the same order,
  // since it just renders that array in order too.
  const moveSubSection = useCallback((dayNum: number, type: SubSectionType, direction: -1 | 1) => {
    setSessions(prev =>
      prev.map(s => {
        if (s.day_of_week !== dayNum) return s
        const idx = s.sections.indexOf(type)
        const newIdx = idx + direction
        if (idx === -1 || newIdx < 0 || newIdx >= s.sections.length) return s
        const nextSections = [...s.sections]
        ;[nextSections[idx], nextSections[newIdx]] = [nextSections[newIdx], nextSections[idx]]

        const bySection = new Map<SubSectionType | null, SessionExercise[]>()
        for (const ex of s.exercises) {
          const key = ex.section ?? null
          if (!bySection.has(key)) bySection.set(key, [])
          bySection.get(key)!.push(ex)
        }
        const nextExercises = nextSections.flatMap(key => bySection.get(key) ?? [])

        return { ...s, sections: nextSections, exercises: nextExercises }
      })
    )
  }, [])

  const updateExercise = useCallback((dayNum: number, exId: string, field: keyof SessionExercise, value: string | number) => {
    setSessions(prev =>
      prev.map(s =>
        s.day_of_week === dayNum
          ? { ...s, exercises: s.exercises.map(e => e.id === exId ? { ...e, [field]: value } : e) }
          : s
      )
    )
  }, [])

  const removeExercise = useCallback((dayNum: number, exId: string) => {
    setSessions(prev =>
      prev.map(s =>
        s.day_of_week === dayNum
          ? { ...s, exercises: withGroupCleanup(s.exercises.filter(e => e.id !== exId)) }
          : s
      )
    )
  }, [])

  // Reordering can pull an exercise out of its superset (it's no longer
  // adjacent to its group), so drop its link first — the group is cleaned
  // up afterwards if that leaves it with a single member.
  //
  // Section-aware: swaps with the nearest exercise (in the given direction)
  // that shares the same `section` tag, skipping over any other sections'
  // exercises interleaved between them — so "move up/down" stays within the
  // sub-section it's in rather than crossing into a neighbouring one.
  const moveExercise = useCallback((dayNum: number, exId: string, direction: -1 | 1) => {
    setSessions(prev =>
      prev.map(s => {
        if (s.day_of_week !== dayNum) return s
        const idx = s.exercises.findIndex(e => e.id === exId)
        if (idx === -1) return s
        const section = s.exercises[idx].section
        let swapIdx = -1
        for (let i = idx + direction; i >= 0 && i < s.exercises.length; i += direction) {
          if (s.exercises[i].section === section) { swapIdx = i; break }
        }
        if (swapIdx === -1) return s
        const cleared = s.exercises.map(e => e.id === exId ? { ...e, group_id: undefined } : e)
        const next = [...cleared]
        ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
        return { ...s, exercises: withGroupCleanup(next) }
      })
    )
  }, [])

  // Toggles a single exercise in/out of exId's superset — used by the "SS"
  // picker, where the coach checks/unchecks individual exercises to build
  // the group rather than only linking to the exercise directly above.
  const toggleSupersetMember = useCallback((dayNum: number, exId: string, otherId: string) => {
    setSessions(prev =>
      prev.map(s => {
        if (s.day_of_week !== dayNum) return s
        const cur = s.exercises.find(e => e.id === exId)
        if (!cur) return s
        const isCurrentMember = !!cur.group_id && s.exercises.find(e => e.id === otherId)?.group_id === cur.group_id
        const partnerIds = new Set(
          s.exercises.filter(e => e.id !== exId && cur.group_id && e.group_id === cur.group_id).map(e => e.id)
        )
        if (isCurrentMember) partnerIds.delete(otherId)
        else partnerIds.add(otherId)
        return { ...s, exercises: applySupersetSelection(s.exercises, exId, partnerIds) }
      })
    )
  }, [])

  const updateCardioConfig = useCallback((dayNum: number, updates: Partial<CardioConfig>) => {
    setSessions(prev =>
      prev.map(s =>
        s.day_of_week === dayNum
          ? { ...s, cardio_config: { ...(s.cardio_config ?? defaultCardioConfig()), ...updates } }
          : s
      )
    )
  }, [])

  // ── Drag & drop ──────────────────────────────────────────────────────────

  function handleLibDragStart(ex: ExerciseRow) {
    dragExRef.current = ex
  }

  // Reads the target section off the drop zone's own data-section attribute
  // rather than closing over it per-zone — so the same stable handler can be
  // passed to every zone's onDrop without wrapping it in a fresh per-render
  // arrow function (which the refs lint rule flags, since this reads a ref
  // as a defensive fallback below).
  function handleDropzoneDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDropTarget(null)
    if (activeDay == null) return
    const section = (e.currentTarget.dataset.section || undefined) as SubSectionType | undefined
    const exId = e.dataTransfer.getData('exercise_id')
    const ex = (exId ? exercises.find(x => x.id === exId) : null) ?? dragExRef.current
    if (ex) addExerciseToSession(activeDay, ex, section)
    dragExRef.current = null
  }

  // ── Save helpers ─────────────────────────────────────────────────────────

  function buildSessionRows(planId: string) {
    return sessions.map(s => ({
      training_plan_id: planId,
      day_of_week: s.day_of_week,
      title: s.title,
      // Never wrote this before — training_sessions.session_type silently
      // stayed at its column default ('styrke') for every session ever
      // saved, cardio included. On the next load, isCardio (below) reads
      // this same column and always got 'styrke' back, so the session
      // reloaded as a strength session with the raw CardioConfig sitting
      // in its exercises array — the "sets/reps instead of cardio fields"
      // bug. Confirmed live: every one of the last 199 saved sessions had
      // session_type = 'styrke', 16 of them unmistakably cardio.
      session_type: s.type,
      exercises: s.type === 'cardio'
        ? (s.cardio_config ? [s.cardio_config] : [])
        : s.exercises,
    }))
  }

  // ── Save (current plan) ───────────────────────────────────────────────────

  // Set the moment handleSave creates a plan; see the comment inside
  // handleSave for why this exists alongside initialPlan?.id.
  const createdPlanIdRef = useRef<string | null>(null)

  async function handleSave() {
    setSaving(true)
    try {
      // Falls back to a ref, not just the initialPlan prop: router.replace()
      // below updates the URL but doesn't guarantee this component gets
      // fresh props with the new plan's id before another save call runs
      // (see createdPlanIdRef below) — without this, a second call still
      // reading a stale null initialPlan?.id would take the create branch
      // again and insert a second training_plans row.
      let planId = initialPlan?.id ?? createdPlanIdRef.current

      if (!planId) {
        const { data, error } = await supabase
          .from('training_plans')
          .insert({
            title,
            description: null,
            client_id: clientId ?? null,
            coach_id: coachId,
            is_active: !isDraft,
          })
          .select('id')
          .single()
        if (error) throw error
        planId = data.id
        createdPlanIdRef.current = planId
        router.replace(clientId ? `/clients/${clientId}/training/${planId}` : `/training-plans/${planId}`)
      } else {
        const { error } = await supabase
          .from('training_plans')
          .update({ title, is_active: !isDraft })
          .eq('id', planId)
        if (error) throw error
      }

      // Checked, not fire-and-forget: if this ever silently failed (RLS,
      // network blip) the insert below would still run and add a second
      // copy of every session on top of whatever's already there.
      const { error: deleteError } = await supabase.from('training_sessions').delete().eq('training_plan_id', planId)
      if (deleteError) throw deleteError
      if (sessions.length > 0) {
        const { error: insertError } = await supabase
          .from('training_sessions')
          .insert(buildSessionRows(planId!))
        if (insertError) throw insertError
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      // Keeps Next's router cache from serving a stale (pre-edit) version
      // of this page — or the plans list — on the next visit.
      router.refresh()
    } catch (err) {
      console.error('Save error:', JSON.stringify(err), err)
    } finally {
      setSaving(false)
    }
  }

  // Auto-save: debounce ~2.5s after any change to the title, draft toggle
  // or sessions — including the very first change on a brand-new,
  // not-yet-saved plan (handleSave already knows how to insert vs. update).
  // Skips the initial mount so merely landing on "new plan" doesn't
  // immediately create an empty row — only an actual change (adding a
  // session, editing the title, ...) starts the debounce. The existing
  // Lagre button's label ("Lagrer..." / "Lagret ✓") doubles as the
  // auto-save indicator since it's driven by the same saving/saved state.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSaveRef = useRef(handleSave)
  useEffect(() => { handleSaveRef.current = handleSave })

  // Serializes save calls: if a change fires while a previous save is
  // still in flight (slow network), queue exactly one more run right
  // after it finishes instead of letting two overlapping saves race —
  // the DELETE-then-INSERT in handleSave isn't atomic, so an older,
  // slower save completing after a newer one could otherwise silently
  // overwrite it with stale data.
  const saveInFlightRef = useRef<Promise<void> | null>(null)
  const saveQueuedRef = useRef(false)
  const runSave = useCallback(function runSaveImpl() {
    // Cancel any independently-pending debounce timer before running —
    // otherwise a save triggered some other way (e.g. the Lagre button)
    // leaves that timer armed, and it fires a redundant save later with no
    // further changes to justify it. For a not-yet-created plan that
    // redundant call used to insert a second training_plans row, since
    // nothing else would have cleared the timer for it.
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null }
    if (saveInFlightRef.current) { saveQueuedRef.current = true; return }
    const run = handleSaveRef.current()
    saveInFlightRef.current = run.finally(() => {
      saveInFlightRef.current = null
      if (saveQueuedRef.current) { saveQueuedRef.current = false; runSaveImpl() }
    })
  }, [])

  const isFirstRenderRef = useRef(true)
  useEffect(() => {
    if (isFirstRenderRef.current) { isFirstRenderRef.current = false; return }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => { saveTimerRef.current = null; runSave() }, 2500)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [title, isDraft, sessions, runSave])

  // Flushes a still-pending debounced save immediately when the coach
  // navigates away, instead of the effect above silently cancelling it on
  // unmount — previously, any edit made in the last ~2.5s before leaving
  // the page was never persisted.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
        runSave()
      }
    }
  }, [runSave])

  // ── Save as template (always creates a new plan) ──────────────────────────

  async function handleSaveAsTemplate() {
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('training_plans')
        .insert({
          title,
          description: null,
          client_id: null,
          coach_id: coachId,
          is_active: true,
          is_template: true,
        })
        .select('id')
        .single()
      if (error) throw error

      if (sessions.length > 0) {
        const { error: insertError } = await supabase
          .from('training_sessions')
          .insert(buildSessionRows(data.id))
        if (insertError) throw insertError
      }

      setSavedTemplate(true)
      setTimeout(() => setSavedTemplate(false), 2500)
    } catch (err) {
      console.error('Template save error:', JSON.stringify(err), err)
    } finally {
      setSaving(false)
    }
  }

  // training_sessions has ON DELETE CASCADE on training_plan_id, so
  // deleting the plan row is enough — no separate sessions cleanup needed.
  async function handleDeletePlan() {
    if (!initialPlan?.id) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('training_plans').delete().eq('id', initialPlan.id)
      if (error) throw error
      router.push(clientId ? `/clients/${clientId}/training` : '/training-plans')
      router.refresh()
    } catch (err) {
      console.error('Delete plan error:', JSON.stringify(err), err)
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  async function handleAssign() {
    if (!selectedClientId || !initialPlan?.id) return
    setAssigning(true)
    try {
      const res = await fetch(`/api/training-plans/${initialPlan.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: selectedClientId }),
      })
      const data = await res.json()
      if (data.newPlanId) router.push(`/training-plans/${data.newPlanId}`)
    } finally {
      setAssigning(false)
      setAssignOpen(false)
      setAssignQuery('')
      setSelectedClientId('')
    }
  }

  const selectedAssignClient = clients.find(c => c.id === selectedClientId)
  const filteredAssignClients = useMemo(() => {
    const q = assignQuery.trim().toLowerCase()
    if (!q) return clients
    return clients.filter(c => c.name.toLowerCase().includes(q))
  }, [clients, assignQuery])

  const activeSession = sessions.find(s => s.day_of_week === activeDay) ?? null

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">

      {showTypeModal && (
        <SessionTypeModal
          onSelectStrength={() => { setShowTypeModal(false); addStrengthSession() }}
          onSelectCardio={() => { setShowTypeModal(false); setShowCardioModal(true) }}
          onClose={() => setShowTypeModal(false)}
        />
      )}

      {showCardioModal && (
        <CardioSessionModal
          onAdd={addCardioSession}
          onClose={() => setShowCardioModal(false)}
        />
      )}

      {cardioSubSectionDay != null && (
        <CardioSessionModal
          initial={
            sessions
              .find(s => s.day_of_week === cardioSubSectionDay)
              ?.exercises.find(e => e.section === 'cardio' && e.cardioConfig)?.cardioConfig
          }
          onAdd={config => { saveCardioSubSection(cardioSubSectionDay, config); setCardioSubSectionDay(null) }}
          onClose={() => setCardioSubSectionDay(null)}
        />
      )}

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-white shrink-0">
        <Link
          href={clientId ? `/clients/${clientId}/training` : '/training-plans'}
          className="text-gray-400 hover:text-gray-600"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>

        <div className="flex-1 flex items-center gap-3">
          {clientName && <span className="text-sm text-gray-400">{clientName} /</span>}
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="text-lg font-bold text-gray-900 bg-transparent focus:outline-none border-b-2 border-transparent focus:border-[#6ecfb0] transition-colors"
          />
        </div>

        <button
          onClick={() => setIsDraft(d => !d)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
            isDraft
              ? 'bg-amber-50 border-amber-300 text-amber-700'
              : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isDraft ? 'bg-amber-400' : 'bg-gray-300'}`} />
          {isDraft ? 'Kladd' : 'Aktiv'}
        </button>

        {!clientId && initialPlan?.id && (
          assignOpen ? (
            <div className="flex items-start gap-2">
              <div className="relative">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    autoFocus
                    value={selectedAssignClient ? selectedAssignClient.name : assignQuery}
                    onChange={e => { setAssignQuery(e.target.value); setSelectedClientId('') }}
                    onFocus={() => setSelectedClientId('')}
                    placeholder="Søk klient..."
                    className="h-9 w-48 text-sm border border-gray-300 rounded-lg pl-7 pr-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#6ecfb0]"
                  />
                </div>
                {!selectedClientId && (
                  <div className="absolute z-20 mt-1 w-48 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                    {filteredAssignClients.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-gray-400">Ingen treff</p>
                    ) : (
                      filteredAssignClients.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setSelectedClientId(c.id); setAssignQuery(c.name) }}
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-[#ebf5ef] transition-colors"
                        >
                          {c.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <button onClick={handleAssign} disabled={!selectedClientId || assigning} className="h-9 px-3 text-sm font-semibold rounded-lg bg-[#1a5c3a] text-white hover:bg-[#2d8653] disabled:opacity-50">
                {assigning ? 'Tildeler...' : 'Tildel'}
              </button>
              <button onClick={() => { setAssignOpen(false); setAssignQuery(''); setSelectedClientId('') }} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <button onClick={() => setAssignOpen(true)} className="flex items-center gap-1.5 h-9 px-3 text-sm font-semibold rounded-lg border border-gray-200 hover:border-gray-300 text-gray-600">
              <UserPlus className="w-4 h-4" />
              Tildel
            </button>
          )
        )}

        {initialPlan?.id && (
          confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600">Slett denne planen?</span>
              <button
                onClick={handleDeletePlan}
                disabled={deleting}
                className="h-9 px-3 text-sm font-semibold rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Sletter...' : 'Ja, slett'}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="h-9 px-3 text-sm text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                Avbryt
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 h-9 px-3 text-sm font-semibold rounded-lg border border-gray-200 hover:border-red-300 text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Slett plan
            </button>
          )
        )}

        <button onClick={handleSaveAsTemplate} disabled={saving} className="flex items-center gap-1.5 h-9 px-3 text-sm font-semibold rounded-lg border border-gray-200 hover:border-[#6ecfb0] text-gray-600 hover:text-[#1a5c3a] transition-colors">
          <Save className="w-4 h-4" />
          {savedTemplate ? 'Mal lagret ✓' : 'Lagre som mal'}
        </button>

        {/* runSave, not handleSave directly: the debounced auto-save and
            this button both need to go through the same in-flight guard,
            since handleSave's DELETE-then-INSERT of sessions isn't atomic —
            calling handleSave directly here let a manual click race an
            in-progress auto-save (neither one visible to the other's
            saveInFlightRef), so both would DELETE then INSERT concurrently
            and double every session. */}
        <button onClick={runSave} disabled={saving} className="flex items-center gap-1.5 h-9 px-4 text-sm font-bold rounded-lg bg-gradient-to-r from-[#1a5c3a] to-[#6ecfb0] text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
          <Save className="w-4 h-4" />
          {saved ? 'Lagret ✓' : saving ? 'Lagrer...' : 'Lagre'}
        </button>
      </div>

      {/* ── Two-column body ── */}
      <div className="flex flex-1 min-h-0">

        {/* ══ LEFT: Exercise library ══ */}
        <div className="w-[340px] shrink-0 border-r border-gray-100 flex flex-col bg-gray-50">
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={libSearch}
                onChange={e => setLibSearch(e.target.value)}
                placeholder="Søk i øvelsesbibliotek..."
                className="w-full pl-9 pr-3 h-9 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6ecfb0]"
              />
            </div>
          </div>

          <div className="flex border-b border-gray-100 bg-white">
            {(['alle', 'standard', 'mine'] as const).map(t => (
              <button key={t} onClick={() => setLibTab(t)} className={`flex-1 py-2 text-xs font-semibold capitalize transition-colors ${libTab === t ? 'text-[#1a5c3a] border-b-2 border-[#1a5c3a]' : 'text-gray-400 hover:text-gray-600'}`}>
                {t === 'alle' ? 'Alle' : t === 'standard' ? 'Standard' : 'Mine'}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5 px-3 py-2.5 overflow-x-auto scrollbar-hide border-b border-gray-100 shrink-0">
            {MUSCLE_PILLS.map(pill => (
              <button key={pill} onClick={() => setMusclePill(pill)} className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors ${musclePill === pill ? 'bg-[#1a5c3a] text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-[#6ecfb0] hover:text-[#1a5c3a]'}`}>
                {pill}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {filteredExercises.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-sm">
                <Dumbbell className="w-8 h-8 mb-2 text-gray-200" />
                <p>Ingen øvelser funnet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {filteredExercises.map(ex => (
                  <ExerciseCard
                    key={ex.id}
                    ex={ex}
                    onDragStart={() => handleLibDragStart(ex)}
                    onAdd={() => {
                      if (activeSession?.type === 'cardio') return
                      if (activeDay == null) { setShowTypeModal(true); return }
                      addExerciseToSession(activeDay, ex)
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ══ RIGHT: Sessions panel ══ */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">

          {/* Session tabs */}
          <div className="flex items-center gap-1 px-4 py-3 border-b border-gray-100 overflow-x-auto scrollbar-hide shrink-0">
            {sessions.map((s, tabIdx) => {
              const count = s.type === 'cardio' ? (s.cardio_config ? 1 : 0) : s.exercises.length
              const isActive = activeDay === s.day_of_week
              return (
                <div key={s.day_of_week} className="flex items-center gap-1 shrink-0 bg-gray-50 rounded-xl p-1">
                  <button
                    onClick={() => moveSession(s.day_of_week, -1)}
                    disabled={tabIdx === 0}
                    title="Flytt økt tidligere"
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-500 shadow-sm hover:bg-[#ebf5ef] hover:border-[#6ecfb0] hover:text-[#1a5c3a] disabled:opacity-0 disabled:pointer-events-none transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setActiveDay(s.day_of_week)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                      isActive ? 'bg-[#1a5c3a] text-white' : 'bg-gray-100 text-gray-600 hover:bg-[#ebf5ef] hover:text-[#1a5c3a]'
                    }`}
                  >
                    {s.type === 'cardio'
                      ? <Activity className={`w-3 h-3 shrink-0 ${isActive ? 'text-[#6ecfb0]' : 'text-gray-400'}`} />
                      : <Dumbbell className={`w-3 h-3 shrink-0 ${isActive ? 'text-[#6ecfb0]' : 'text-gray-400'}`} />
                    }
                    {s.title}
                    <span className={`text-[10px] ${isActive ? 'text-[#6ecfb0]' : 'text-gray-400'}`}>{count}</span>
                  </button>
                  <button
                    onClick={() => moveSession(s.day_of_week, 1)}
                    disabled={tabIdx === sessions.length - 1}
                    title="Flytt økt senere"
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-500 shadow-sm hover:bg-[#ebf5ef] hover:border-[#6ecfb0] hover:text-[#1a5c3a] disabled:opacity-0 disabled:pointer-events-none transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeSession(s.day_of_week)}
                    title="Fjern økt"
                    className="w-6 h-7 flex items-center justify-center rounded-lg text-xs text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >✕</button>
                </div>
              )
            })}

            {sessions.length < 7 && (
              <button
                onClick={() => setShowTypeModal(true)}
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-[#1a5c3a] to-[#6ecfb0] hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                Legg til ny økt
              </button>
            )}
          </div>

          {/* Session content */}
          <div className="flex-1 overflow-y-auto p-5">
            {activeSession == null ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-20 h-20 rounded-2xl bg-[#ebf5ef] flex items-center justify-center mb-5">
                  <Dumbbell className="w-9 h-9 text-[#6ecfb0]" />
                </div>
                <h3 className="text-lg font-bold text-gray-700 mb-2">Ingen økter ennå</h3>
                <p className="text-sm text-gray-400 mb-6 max-w-xs">
                  Legg til en treningsøkt og dra øvelser fra biblioteket til venstre inn i økten.
                </p>
                <button
                  onClick={() => setShowTypeModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#1a5c3a] to-[#6ecfb0] text-white font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  <Plus className="w-4 h-4" />
                  Legg til ny økt
                </button>
              </div>
            ) : (
              <div className="max-w-3xl space-y-2">
                {/* Session title row */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="group/title flex items-center gap-1.5">
                    <input
                      value={activeSession.title}
                      onChange={e => updateSession(activeSession.day_of_week, 'title', e.target.value)}
                      placeholder="Navn på økt..."
                      className="text-xl font-bold text-gray-900 bg-transparent focus:outline-none border-b-2 border-gray-200 hover:border-gray-300 focus:border-[#6ecfb0] transition-colors"
                    />
                    <Pencil className="w-3.5 h-3.5 text-gray-300 group-hover/title:text-gray-400 transition-colors shrink-0" />
                  </div>
                  <span className="flex items-center gap-1 text-sm text-gray-400">
                    {activeSession.type === 'cardio'
                      ? <><Activity className="w-4 h-4" /> Cardio</>
                      : <><Dumbbell className="w-4 h-4" /> Styrke</>
                    }
                  </span>
                  <span className="text-sm text-gray-300">·</span>
                  <span className="text-sm text-gray-400">{DAYS[activeSession.day_of_week - 1]}</span>
                </div>

                {/* ── Styrkeøkt ── */}
                {activeSession.type === 'styrke' && (() => {
                  const dayNum = activeSession.day_of_week

                  // Renders one section's worth of exercises (unsectioned
                  // when `sectionFilter` is undefined) — its own superset
                  // grouping, drop zone and manual-add button, with
                  // move-up/down bounded to this section's own local range.
                  // Named distinctly from the `secType` loop variable below
                  // (which this is called with) purely to avoid shadowing —
                  // both always carry the same value at any given call site.
                  const renderExerciseSection = (sectionFilter: SubSectionType | undefined) => {
                    const sectionExercises = activeSession.exercises.filter(e => (e.section ?? undefined) === sectionFilter)
                    const zoneKey = sectionFilter ?? 'unsectioned'

                    const renderRow = (ex: SessionExercise, groupLabel?: string) => {
                      const localIdx = sectionExercises.findIndex(e => e.id === ex.id)
                      return (
                        <SessionExerciseRow
                          key={ex.id}
                          ex={ex}
                          exerciseLibrary={exercises}
                          groupLabel={groupLabel}
                          sessionExercises={activeSession.exercises}
                          pickerOpen={supersetPickerFor === ex.id}
                          onOpenPicker={() => setSupersetPickerFor(ex.id)}
                          onClosePicker={() => setSupersetPickerFor(null)}
                          onToggleSupersetMember={otherId => toggleSupersetMember(dayNum, ex.id, otherId)}
                          onChange={(field, value) => updateExercise(dayNum, ex.id, field, value)}
                          onRemove={() => removeExercise(dayNum, ex.id)}
                          onMoveUp={localIdx > 0 ? () => moveExercise(dayNum, ex.id, -1) : undefined}
                          onMoveDown={localIdx < sectionExercises.length - 1 ? () => moveExercise(dayNum, ex.id, 1) : undefined}
                        />
                      )
                    }

                    return (
                      <div className="space-y-2">
                        {buildExerciseBlocks(sectionExercises).map(block => {
                          if (block.type === 'single') return renderRow(block.ex)
                          return (
                            <div
                              key={block.exs[0].id}
                              className="rounded-xl border-2 border-[#6ecfb0] bg-[#ebf5ef]/40 p-2 space-y-2"
                            >
                              <div className="flex items-center gap-1.5 px-1">
                                <Link2 className="w-3.5 h-3.5 text-[#1a5c3a]" />
                                <span className="text-xs font-bold text-[#1a5c3a] uppercase tracking-wide">
                                  Supersett {block.label}
                                </span>
                              </div>
                              {block.exs.map((ex, gi) => renderRow(ex, `${block.label}${gi + 1}`))}
                            </div>
                          )
                        })}
                        <div
                          data-section={sectionFilter ?? ''}
                          onDragOver={e => { e.preventDefault(); setDropTarget(zoneKey) }}
                          onDragLeave={() => setDropTarget(null)}
                          onDrop={handleDropzoneDrop}
                          className={`mt-3 rounded-xl border-2 border-dashed p-4 text-center text-sm transition-colors ${
                            dropTarget === zoneKey
                              ? 'border-[#2d8653] bg-[#ebf5ef] text-[#1a5c3a]'
                              : 'border-gray-200 text-gray-400 hover:border-[#6ecfb0] hover:text-[#2d8653]'
                          }`}
                        >
                          {dropTarget === zoneKey ? '✓ Slipp for å legge til' : 'Dra øvelser hit fra biblioteket'}
                        </div>
                        <button
                          onClick={() => addExerciseToSession(dayNum, undefined, sectionFilter)}
                          className="flex items-center gap-2 mt-1 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-[#1a5c3a] hover:bg-[#ebf5ef] transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          Legg til øvelse manuelt
                        </button>
                      </div>
                    )
                  }

                  return (
                    <>
                      {activeSession.sections.map((secType, secIdx) => {
                        // The unsectioned group has no header/controls of
                        // its own — it's just wherever it sits in the
                        // order — but it's still a real slot so a named
                        // section's up/down buttons can swap past it
                        // (that's what lets e.g. "Oppvarming" move above
                        // pre-existing untagged exercises).
                        if (secType === null) {
                          // Once named sections exist alongside it, the
                          // unsectioned group needs its own label too —
                          // otherwise it just looks like an orphaned,
                          // unexplained block of exercises above the named
                          // ones. No move/remove controls though: it isn't
                          // a real removable section, just wherever
                          // untagged exercises happen to sit.
                          const hasNamedSections = activeSession.sections.some(t => t !== null)
                          return (
                            <div key="unsectioned">
                              {hasNamedSections && (
                                <h4 className="flex items-center gap-1.5 mb-2 text-xs font-bold text-[#1a5c3a] uppercase tracking-wide">
                                  <Plus className="w-3.5 h-3.5 text-[#2d8653]" />
                                  Generelt
                                </h4>
                              )}
                              {renderExerciseSection(undefined)}
                            </div>
                          )
                        }
                        const cardioEntry = secType === 'cardio'
                          ? activeSession.exercises.find(e => e.section === 'cardio' && e.cardioConfig)
                          : undefined

                        return (
                          <div key={secType} className="mt-5 pt-4 border-t-2 border-[#cdeee3]">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="flex items-center gap-1.5 text-xs font-bold text-[#1a5c3a] uppercase tracking-wide">
                                <span className="text-[#2d8653]">{SUBSECTION_ICONS[secType]}</span>
                                {SUBSECTION_LABELS[secType]}
                              </h4>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => moveSubSection(dayNum, secType, -1)}
                                  disabled={secIdx === 0}
                                  title="Flytt seksjon opp"
                                  className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:bg-[#ebf5ef] hover:text-[#1a5c3a] disabled:opacity-20 disabled:pointer-events-none transition-colors"
                                >
                                  <ChevronUp className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => moveSubSection(dayNum, secType, 1)}
                                  disabled={secIdx === activeSession.sections.length - 1}
                                  title="Flytt seksjon ned"
                                  className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:bg-[#ebf5ef] hover:text-[#1a5c3a] disabled:opacity-20 disabled:pointer-events-none transition-colors"
                                >
                                  <ChevronDown className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => removeSubSection(dayNum, secType)}
                                  title="Fjern seksjon"
                                  className="w-6 h-6 flex items-center justify-center rounded-md text-gray-300 hover:bg-red-50 hover:text-red-400 transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            {secType === 'cardio' ? (
                              cardioEntry?.cardioConfig ? (
                                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 flex items-center justify-between gap-3">
                                  <div className="text-sm text-gray-700 min-w-0">
                                    <p className="font-semibold truncate">
                                      {cardioEntry.cardioConfig.activity_type}
                                      <span className="font-normal text-gray-400"> · {cardioEntry.cardioConfig.cardio_mode}</span>
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      {[
                                        cardioEntry.cardioConfig.duration_min && `${cardioEntry.cardioConfig.duration_min} min`,
                                        cardioEntry.cardioConfig.distance_km && `${cardioEntry.cardioConfig.distance_km} km`,
                                        cardioEntry.cardioConfig.heart_rate_zone,
                                      ].filter(Boolean).join(' · ') || 'Ingen detaljer satt'}
                                    </p>
                                    {cardioEntry.cardioConfig.notes && (
                                      <p className="text-xs text-gray-400 mt-1 truncate">{cardioEntry.cardioConfig.notes}</p>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => setCardioSubSectionDay(dayNum)}
                                    className="shrink-0 h-8 px-3 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:border-[#6ecfb0] hover:text-[#1a5c3a] transition-colors"
                                  >
                                    Rediger
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setCardioSubSectionDay(dayNum)}
                                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-gray-200 text-sm font-medium text-gray-400 hover:border-[#6ecfb0] hover:text-[#1a5c3a] transition-colors"
                                >
                                  <Activity className="w-4 h-4" />
                                  Legg til kardio-detaljer
                                </button>
                              )
                            ) : (
                              renderExerciseSection(secType)
                            )}
                          </div>
                        )
                      })}

                      <div className="mt-4">
                        <SubSectionAdder
                          existing={activeSession.sections.filter((t): t is SubSectionType => t !== null)}
                          onAdd={type => {
                            // Cardio needs its config up front (via the
                            // same modal as a whole cardio-økt) rather than
                            // starting as an empty exercise-row section.
                            if (type === 'cardio') setCardioSubSectionDay(dayNum)
                            else addSubSection(dayNum, type)
                          }}
                        />
                      </div>
                    </>
                  )
                })()}

                {/* ── Cardio-økt ── */}
                {activeSession.type === 'cardio' && (
                  <div className="max-w-md">
                    <div className="p-5 rounded-xl border border-gray-100 bg-gray-50">
                      <CardioForm
                        config={activeSession.cardio_config ?? defaultCardioConfig()}
                        onChange={updates => updateCardioConfig(activeSession.day_of_week, updates)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
