'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import {
  Plus, Trash2, Save, ChevronLeft, UserPlus, X, Search, Dumbbell, Activity, Pencil, Video,
} from 'lucide-react'
import Link from 'next/link'
import type { ExerciseRow } from '@/app/(dashboard)/exercise-library/exercise-form-modal'
import { exerciseThumbnail } from '@/lib/video-thumbnail'

// ── Types ─────────────────────────────────────────────────────────────────────

type SessionType = 'styrke' | 'cardio'

type SessionExercise = {
  id: string
  exercise_id?: string
  name: string
  sets: number
  reps: string
  weight: string
  rest: string
  notes: string
  thumbnail_url?: string | null
  video_url?: string | null
  muscle_groups?: string[]
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
  }
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

function CardioSessionModal({ onAdd, onClose }: {
  onAdd: (config: CardioConfig) => void
  onClose: () => void
}) {
  const [config, setConfig] = useState<CardioConfig>(defaultCardioConfig())

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
            <h2 className="text-lg font-bold text-gray-900">Legg til kardio</h2>
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
            Legg til
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

function SessionExerciseRow({
  ex,
  onChange,
  onRemove,
}: {
  ex: SessionExercise
  onChange: (field: keyof SessionExercise, value: string | number) => void
  onRemove: () => void
}) {
  const primaryMuscle = ex.muscle_groups?.[0]
  const colorClass = primaryMuscle ? (MUSCLE_COLORS[primaryMuscle] ?? 'bg-gray-100 text-gray-500') : 'bg-gray-100 text-gray-500'
  const thumb = exerciseThumbnail(ex)

  return (
    <div className="flex items-center gap-2 p-3 bg-white rounded-xl border border-gray-100 group hover:border-[#6ecfb0] transition-colors">
      <div className="relative w-10 h-10 rounded-lg bg-gradient-to-br from-[#ebf5ef] to-[#cdeee3] flex items-center justify-center shrink-0 overflow-hidden group/thumb">
        {thumb
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={thumb} alt={ex.name} className="w-full h-full object-cover" />
          : <Dumbbell className="w-4 h-4 text-[#6ecfb0]" />
        }
        {ex.video_url && (
          <a
            href={ex.video_url}
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
        {primaryMuscle && (
          <span className={`inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-0 rounded-full ${colorClass}`}>
            {primaryMuscle}
          </span>
        )}
      </div>

      {/* Sett */}
      <div className="text-center">
        <p className="text-[10px] text-gray-400 mb-0.5">Sett</p>
        <div className="flex items-center gap-1">
          <button onClick={() => onChange('sets', Math.max(1, ex.sets - 1))} className="w-5 h-5 rounded bg-gray-100 text-gray-500 hover:bg-[#ebf5ef] hover:text-[#1a5c3a] text-xs flex items-center justify-center">−</button>
          <span className="w-5 text-center text-sm font-bold text-gray-700">{ex.sets}</span>
          <button onClick={() => onChange('sets', ex.sets + 1)} className="w-5 h-5 rounded bg-gray-100 text-gray-500 hover:bg-[#ebf5ef] hover:text-[#1a5c3a] text-xs flex items-center justify-center">+</button>
        </div>
      </div>

      {/* Reps */}
      <div className="text-center">
        <p className="text-[10px] text-gray-400 mb-0.5">Reps</p>
        <input value={ex.reps} onChange={e => onChange('reps', e.target.value)} className="w-14 text-sm font-semibold text-center border border-gray-200 rounded-lg px-1.5 py-1 focus:outline-none focus:border-[#6ecfb0]" placeholder="8–10" />
      </div>

      {/* Vekt */}
      <div className="text-center">
        <p className="text-[10px] text-gray-400 mb-0.5">Vekt</p>
        <input value={ex.weight} onChange={e => onChange('weight', e.target.value)} className="w-14 text-sm font-semibold text-center border border-gray-200 rounded-lg px-1.5 py-1 focus:outline-none focus:border-[#6ecfb0]" placeholder="kg" />
      </div>

      {/* Pause */}
      <div className="text-center">
        <p className="text-[10px] text-gray-400 mb-0.5">Pause</p>
        <input value={ex.rest} onChange={e => onChange('rest', e.target.value)} className="w-14 text-sm font-semibold text-center border border-gray-200 rounded-lg px-1.5 py-1 focus:outline-none focus:border-[#6ecfb0]" placeholder="60s" />
      </div>

      {/* Notes */}
      <input value={ex.notes} onChange={e => onChange('notes', e.target.value)} placeholder="Notater..." className="w-28 text-xs text-gray-500 border border-gray-200 rounded-lg px-1.5 py-1 focus:outline-none focus:border-[#6ecfb0] placeholder:text-gray-300" />

      <button onClick={onRemove} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all">
        <Trash2 className="w-4 h-4" />
      </button>
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

  const [sessions, setSessions] = useState<Session[]>(
    (initialPlan?.sessions ?? [])
      .sort((a, b) => a.day_of_week - b.day_of_week)
      .map(s => {
        const isCardio = s.session_type === 'cardio'
        const firstEx = Array.isArray(s.exercises) && s.exercises.length > 0 ? s.exercises[0] : null
        const hasCardioConfig = firstEx && typeof firstEx === 'object' && 'activity_type' in (firstEx as object)
        return {
          id: s.id,
          day_of_week: s.day_of_week,
          title: s.title,
          type: isCardio ? 'cardio' : 'styrke',
          exercises: isCardio ? [] : (s.exercises as SessionExercise[]),
          cardio_config: isCardio && hasCardioConfig ? (firstEx as CardioConfig) : null,
        }
      })
  )
  const [activeDay, setActiveDay] = useState<number | null>(
    initialPlan?.sessions?.[0]?.day_of_week ?? null
  )

  const [showTypeModal, setShowTypeModal]   = useState(false)
  const [showCardioModal, setShowCardioModal] = useState(false)

  const [assignOpen, setAssignOpen]         = useState(false)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [assigning, setAssigning]           = useState(false)

  const [libSearch, setLibSearch]   = useState('')
  const [libTab, setLibTab]         = useState<'alle' | 'standard' | 'mine'>('alle')
  const [musclePill, setMusclePill] = useState('Alle')
  const [dropTarget, setDropTarget] = useState(false)
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
    }
    setSessions(prev => [...prev, s].sort((a, b) => a.day_of_week - b.day_of_week))
    setActiveDay(nextDay)
    setShowCardioModal(false)
  }

  const removeSession = useCallback((dayNum: number) => {
    setSessions(prev => prev.filter(s => s.day_of_week !== dayNum))
    setActiveDay(prev => prev === dayNum ? null : prev)
  }, [])

  const updateSession = useCallback((dayNum: number, field: 'title', value: string) => {
    setSessions(prev => prev.map(s => s.day_of_week === dayNum ? { ...s, [field]: value } : s))
  }, [])

  const addExerciseToSession = useCallback((dayNum: number, from?: ExerciseRow) => {
    setSessions(prev =>
      prev.map(s =>
        s.day_of_week === dayNum
          ? { ...s, exercises: [...s.exercises, newExercise(from)] }
          : s
      )
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
          ? { ...s, exercises: s.exercises.filter(e => e.id !== exId) }
          : s
      )
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

  function handleDropzoneDrop(e: React.DragEvent) {
    e.preventDefault()
    setDropTarget(false)
    if (activeDay == null) return
    const exId = e.dataTransfer.getData('exercise_id')
    const ex = (exId ? exercises.find(x => x.id === exId) : null) ?? dragExRef.current
    if (ex) addExerciseToSession(activeDay, ex)
    dragExRef.current = null
  }

  // ── Save helpers ─────────────────────────────────────────────────────────

  function buildSessionRows(planId: string) {
    return sessions.map(s => ({
      training_plan_id: planId,
      day_of_week: s.day_of_week,
      title: s.title,
      exercises: s.type === 'cardio'
        ? (s.cardio_config ? [s.cardio_config] : [])
        : s.exercises,
    }))
  }

  // ── Save (current plan) ───────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true)
    try {
      let planId = initialPlan?.id

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
        router.replace(clientId ? `/clients/${clientId}/training/${planId}` : `/training-plans/${planId}`)
      } else {
        const { error } = await supabase
          .from('training_plans')
          .update({ title, is_active: !isDraft })
          .eq('id', planId)
        if (error) throw error
      }

      await supabase.from('training_sessions').delete().eq('training_plan_id', planId)
      if (sessions.length > 0) {
        const { error: insertError } = await supabase
          .from('training_sessions')
          .insert(buildSessionRows(planId!))
        if (insertError) throw insertError
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Save error:', JSON.stringify(err), err)
    } finally {
      setSaving(false)
    }
  }

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
    }
  }

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
            <div className="flex items-center gap-2">
              <select
                value={selectedClientId}
                onChange={e => setSelectedClientId(e.target.value)}
                className="h-9 text-sm border border-gray-300 rounded-lg px-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#6ecfb0]"
              >
                <option value="">Velg klient...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={handleAssign} disabled={!selectedClientId || assigning} className="h-9 px-3 text-sm font-semibold rounded-lg bg-[#1a5c3a] text-white hover:bg-[#2d8653] disabled:opacity-50">
                {assigning ? 'Tildeler...' : 'Tildel'}
              </button>
              <button onClick={() => setAssignOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <button onClick={() => setAssignOpen(true)} className="flex items-center gap-1.5 h-9 px-3 text-sm font-semibold rounded-lg border border-gray-200 hover:border-gray-300 text-gray-600">
              <UserPlus className="w-4 h-4" />
              Tildel
            </button>
          )
        )}

        <button onClick={handleSaveAsTemplate} disabled={saving} className="flex items-center gap-1.5 h-9 px-3 text-sm font-semibold rounded-lg border border-gray-200 hover:border-[#6ecfb0] text-gray-600 hover:text-[#1a5c3a] transition-colors">
          <Save className="w-4 h-4" />
          {savedTemplate ? 'Mal lagret ✓' : 'Lagre som mal'}
        </button>

        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 h-9 px-4 text-sm font-bold rounded-lg bg-gradient-to-r from-[#1a5c3a] to-[#6ecfb0] text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
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
            {sessions.map(s => {
              const count = s.type === 'cardio' ? (s.cardio_config ? 1 : 0) : s.exercises.length
              const isActive = activeDay === s.day_of_week
              return (
                <div key={s.day_of_week} className="flex items-center gap-0 shrink-0">
                  <button
                    onClick={() => setActiveDay(s.day_of_week)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-l-lg text-sm font-semibold transition-colors ${
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
                    onClick={() => removeSession(s.day_of_week)}
                    className={`px-1.5 py-1.5 rounded-r-lg text-xs transition-colors ${isActive ? 'bg-[#1a5c3a] text-[#6ecfb0] hover:text-white' : 'bg-gray-100 text-gray-300 hover:text-red-400 hover:bg-red-50'}`}
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
                {activeSession.type === 'styrke' && (
                  <>
                    {activeSession.exercises.map(ex => (
                      <SessionExerciseRow
                        key={ex.id}
                        ex={ex}
                        onChange={(field, value) => updateExercise(activeSession.day_of_week, ex.id, field, value)}
                        onRemove={() => removeExercise(activeSession.day_of_week, ex.id)}
                      />
                    ))}
                    <div
                      onDragOver={e => { e.preventDefault(); setDropTarget(true) }}
                      onDragLeave={() => setDropTarget(false)}
                      onDrop={handleDropzoneDrop}
                      className={`mt-3 rounded-xl border-2 border-dashed p-5 text-center text-sm transition-colors ${
                        dropTarget
                          ? 'border-[#2d8653] bg-[#ebf5ef] text-[#1a5c3a]'
                          : 'border-gray-200 text-gray-400 hover:border-[#6ecfb0] hover:text-[#2d8653]'
                      }`}
                    >
                      {dropTarget ? '✓ Slipp for å legge til' : 'Dra øvelser hit fra biblioteket'}
                    </div>
                    <button
                      onClick={() => addExerciseToSession(activeSession.day_of_week)}
                      className="flex items-center gap-2 mt-1 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-[#1a5c3a] hover:bg-[#ebf5ef] transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Legg til øvelse manuelt
                    </button>
                  </>
                )}

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
