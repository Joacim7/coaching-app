'use client'

import { useState, useOptimistic, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Pencil, X, Check } from 'lucide-react'
import type { ClientPhase } from '@coaching/types'

const PRESET_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#14b8a6', '#f97316',
]

const PHASE_TYPES = [
  { value: 'bulk',         label: 'Bulk' },
  { value: 'cut',          label: 'Cut' },
  { value: 'vedlikehold',  label: 'Vedlikehold' },
  { value: 'styrke',       label: 'Styrke' },
  { value: 'utholdenhet',  label: 'Utholdenhet' },
  { value: 'ferdighet',    label: 'Ferdighet' },
  { value: 'rehab',        label: 'Rehab' },
  { value: 'egendefinert', label: 'Egendefinert' },
]

function today() {
  return new Date().toISOString().slice(0, 10)
}

function daysBetween(a: string, b: string) {
  return Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
}

type FormState = {
  name: string
  phase_type: string
  color: string
  description: string
  start_date: string
  end_date: string
  training_plan_id: string
  meal_plan_id: string
}

function phaseToForm(p: ClientPhase): FormState {
  return {
    name:             p.name,
    phase_type:       p.phase_type ?? '',
    color:            p.color,
    description:      p.description ?? '',
    start_date:       p.start_date,
    end_date:         p.end_date ?? '',
    training_plan_id: p.training_plan_id ?? '',
    meal_plan_id:     p.meal_plan_id ?? '',
  }
}

function emptyForm(): FormState {
  return { name: '', phase_type: '', color: PRESET_COLORS[0], description: '', start_date: today(), end_date: '', training_plan_id: '', meal_plan_id: '' }
}

interface PlanOption { id: string; title: string }

interface Props {
  clientId: string
  clientSince: string
  initialPhases: ClientPhase[]
  availableTrainingPlans: PlanOption[]
  availableMealPlans: PlanOption[]
}

export function PhaseTimeline({ clientId, clientSince, initialPhases, availableTrainingPlans, availableMealPlans }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [phases, setPhases] = useOptimistic(initialPhases)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState('')

  const [createForm, setCreateForm] = useState<FormState>(emptyForm())
  const [editForm, setEditForm]     = useState<FormState>(emptyForm())

  const tlStart   = clientSince.slice(0, 10)
  const tlEnd     = today()
  const totalDays = Math.max(1, daysBetween(tlStart, tlEnd))

  function pctLeft(date: string) {
    return (daysBetween(tlStart, date) / totalDays) * 100
  }
  function pctWidth(start: string, end: string | null) {
    return Math.max(0.5, (daysBetween(start, end ?? tlEnd) / totalDays) * 100)
  }

  const activePhase = phases.find(p => p.start_date <= tlEnd && (!p.end_date || p.end_date >= tlEnd))

  function startEdit(p: ClientPhase) {
    setEditingId(p.id)
    setEditForm(phaseToForm(p))
    setError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setError('')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!createForm.name.trim()) return
    setSaving(true)
    setError('')

    const res = await fetch(`/api/clients/${clientId}/phases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:             createForm.name,
        color:            createForm.color,
        phase_type:       createForm.phase_type || null,
        description:      createForm.description.trim() || null,
        start_date:       createForm.start_date,
        end_date:         createForm.end_date || null,
        training_plan_id: createForm.training_plan_id || null,
        meal_plan_id:     createForm.meal_plan_id || null,
      }),
    })

    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error ?? 'Noe gikk galt')
      setSaving(false)
      return
    }

    setSaving(false)
    setShowCreateForm(false)
    setCreateForm(emptyForm())
    startTransition(() => router.refresh())
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId || !editForm.name.trim()) return
    setSaving(true)
    setError('')

    const res = await fetch(`/api/clients/${clientId}/phases/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:             editForm.name.trim(),
        color:            editForm.color,
        phase_type:       editForm.phase_type || null,
        description:      editForm.description.trim() || null,
        start_date:       editForm.start_date,
        end_date:         editForm.end_date || null,
        training_plan_id: editForm.training_plan_id || null,
        meal_plan_id:     editForm.meal_plan_id || null,
      }),
    })

    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error ?? 'Noe gikk galt')
      setSaving(false)
      return
    }

    setSaving(false)
    setEditingId(null)
    startTransition(() => router.refresh())
  }

  async function handleDelete(phase: ClientPhase) {
    if (!confirm(`Slett fasen "${phase.name}"?`)) return
    setDeleting(phase.id)
    setPhases(prev => prev.filter(p => p.id !== phase.id))
    await fetch(`/api/clients/${clientId}/phases/${phase.id}`, { method: 'DELETE' })
    setDeleting(null)
    startTransition(() => router.refresh())
  }

  const inputCls  = 'w-full h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8653]'
  const selectCls = inputCls
  const labelCls  = 'block text-xs font-medium text-gray-700 mb-1'

  function PhaseForm({ form, setForm, onSubmit, onCancel, submitLabel }: {
    form: FormState
    setForm: (fn: (v: FormState) => FormState) => void
    onSubmit: (e: React.FormEvent) => void
    onCancel: () => void
    submitLabel: string
  }) {
    return (
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Fasenavn *</label>
            <input
              type="text"
              required
              placeholder="f.eks. Vektnedgang"
              value={form.name}
              onChange={e => setForm(v => ({ ...v, name: e.target.value }))}
              className={inputCls}
              autoFocus
            />
          </div>
          <div>
            <label className={labelCls}>Farge</label>
            <div className="flex items-center gap-1.5 flex-wrap h-9">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm(v => ({ ...v, color: c }))}
                  className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 flex-shrink-0"
                  style={{ backgroundColor: c, borderColor: form.color === c ? '#1f2937' : 'transparent' }}
                />
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className={labelCls}>Fasetype</label>
          <div className="flex flex-wrap gap-1.5">
            {PHASE_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setForm(v => ({ ...v, phase_type: v.phase_type === t.value ? '' : t.value }))}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  form.phase_type === t.value
                    ? 'bg-[#2d8653] text-white border-[#2d8653]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-[#2d8653] hover:text-[#2d8653]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>Beskrivelse (valgfri)</label>
          <textarea
            value={form.description}
            onChange={e => setForm(v => ({ ...v, description: e.target.value }))}
            placeholder="Beskriv målet med denne fasen..."
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Startdato *</label>
            <input
              type="date"
              required
              value={form.start_date}
              onChange={e => setForm(v => ({ ...v, start_date: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Sluttdato (valgfri)</label>
            <input
              type="date"
              value={form.end_date}
              min={form.start_date}
              onChange={e => setForm(v => ({ ...v, end_date: e.target.value }))}
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Treningsprogram</label>
            <select
              value={form.training_plan_id}
              onChange={e => setForm(v => ({ ...v, training_plan_id: e.target.value }))}
              className={selectCls}
            >
              <option value="">— Velg program —</option>
              {availableTrainingPlans.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Matplan</label>
            <select
              value={form.meal_plan_id}
              onChange={e => setForm(v => ({ ...v, meal_plan_id: e.target.value }))}
              className={selectCls}
            >
              <option value="">— Velg matplan —</option>
              {availableMealPlans.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={saving}
            className="h-8 px-4 rounded-lg bg-[#2d8653] text-white text-xs font-semibold hover:bg-[#1a5c3a] disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            {saving ? 'Lagrer…' : submitLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="h-8 px-3 rounded-lg text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Avbryt
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">Klientfaser</h3>
          {activePhase && (
            <p className="text-xs text-gray-400 mt-0.5">
              Aktiv fase: <span style={{ color: activePhase.color }} className="font-semibold">{activePhase.name}</span>
            </p>
          )}
        </div>
        <button
          onClick={() => { setShowCreateForm(v => !v); setError('') }}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2d8653] hover:text-[#1a5c3a] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Legg til fase
        </button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="px-5 py-4 bg-gray-50 border-b border-gray-100">
          <PhaseForm
            form={createForm}
            setForm={setCreateForm as any}
            onSubmit={handleCreate}
            onCancel={() => { setShowCreateForm(false); setCreateForm(emptyForm()); setError('') }}
            submitLabel="Opprett fase"
          />
        </div>
      )}

      {/* Timeline */}
      <div className="p-5">
        {phases.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-full h-3 rounded-full bg-gray-100 mb-4" />
            <p className="text-sm text-gray-400">Ingen faser opprettet ennå</p>
            <p className="text-xs text-gray-300 mt-1">Faser hjelper deg å strukturere klientens treningsreise</p>
          </div>
        ) : (
          <>
            {/* Bar */}
            <div className="relative h-8 mb-3">
              <div className="absolute inset-y-2 left-0 right-0 rounded-full bg-gray-100" />
              {phases.map(p => {
                const left  = pctLeft(p.start_date)
                const width = pctWidth(p.start_date, p.end_date)
                const isActive = !p.end_date || p.end_date >= tlEnd
                return (
                  <div
                    key={p.id}
                    className="absolute top-1.5 h-5 rounded-full flex items-center px-2 overflow-hidden cursor-default"
                    style={{
                      left: `${Math.min(left, 98)}%`,
                      width: `${Math.min(width, 100 - Math.min(left, 98))}%`,
                      backgroundColor: p.color,
                      opacity: isActive ? 1 : 0.55,
                      minWidth: '8px',
                    }}
                    title={`${p.name}: ${formatDate(p.start_date)}${p.end_date ? ' → ' + formatDate(p.end_date) : ' → nå'}`}
                  >
                    <span className="text-white text-[9px] font-bold truncate leading-none select-none">{p.name}</span>
                  </div>
                )
              })}
              <div
                className="absolute top-0 w-0.5 h-8 bg-gray-800 rounded-full z-10"
                style={{ left: '100%', transform: 'translateX(-1px)' }}
              >
                <span className="absolute -top-4 -translate-x-1/2 text-[9px] font-bold text-gray-600 whitespace-nowrap">I dag</span>
              </div>
            </div>

            <div className="flex justify-between text-[10px] text-gray-400 mb-4">
              <span>{formatDate(tlStart)}</span>
              <span>{formatDate(tlEnd)}</span>
            </div>

            {/* Phase list */}
            <div className="space-y-1">
              {phases.map(p => {
                const isActive  = !p.end_date || p.end_date >= tlEnd
                const typeLabel = PHASE_TYPES.find(t => t.value === p.phase_type)?.label

                if (editingId === p.id) {
                  return (
                    <div key={p.id} className="rounded-xl border border-[#cdeee3] bg-[#ebf5ef]/40 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-[#1a5c3a]">Rediger fase</p>
                        <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <PhaseForm
                        form={editForm}
                        setForm={setEditForm as any}
                        onSubmit={handleUpdate}
                        onCancel={cancelEdit}
                        submitLabel="Lagre endringer"
                      />
                    </div>
                  )
                }

                return (
                  <div
                    key={p.id}
                    className="flex items-start justify-between gap-3 py-2 px-3 rounded-xl hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: p.color }} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium text-gray-900 truncate">{p.name}</span>
                          {typeLabel && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{typeLabel}</span>
                          )}
                          {isActive && (
                            <span className="text-[9px] font-bold text-white bg-gray-700 px-1.5 py-0.5 rounded-full">NÅ</span>
                          )}
                        </div>
                        {p.description && (
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{p.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {formatDate(p.start_date)}{p.end_date ? ` → ${formatDate(p.end_date)}` : ' → nå'}
                      </span>
                      <button
                        onClick={() => startEdit(p)}
                        className="p-1 rounded-lg text-gray-300 hover:text-[#2d8653] hover:bg-[#ebf5ef] transition-colors opacity-0 group-hover:opacity-100"
                        title="Rediger fase"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        disabled={deleting === p.id}
                        className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                        title="Slett fase"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
