'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Target, Plus, Pencil, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type ClientGoal = {
  id: string
  target_weight_kg: number | null
  description: string | null
  start_date: string | null
  target_date: string | null
}

interface Props {
  clientId: string
  coachId: string
  initialGoal: ClientGoal | null
}

export function GoalPanel({ clientId, coachId, initialGoal }: Props) {
  const supabase = createClient()
  const [goal, setGoal]       = useState<ClientGoal | null>(initialGoal)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const [targetWeight, setTargetWeight] = useState(initialGoal?.target_weight_kg?.toString() ?? '')
  const [description,  setDescription]  = useState(initialGoal?.description ?? '')
  const [startDate,    setStartDate]    = useState(initialGoal?.start_date ?? '')
  const [targetDate,   setTargetDate]   = useState(initialGoal?.target_date ?? '')

  function openForm() {
    setTargetWeight(goal?.target_weight_kg?.toString() ?? '')
    setDescription(goal?.description ?? '')
    setStartDate(goal?.start_date ?? '')
    setTargetDate(goal?.target_date ?? '')
    setError(null)
    setShowForm(true)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    const payload = {
      client_id:        clientId,
      coach_id:         coachId,
      target_weight_kg: targetWeight ? parseFloat(targetWeight) : null,
      description:      description.trim() || null,
      start_date:       startDate || null,
      target_date:      targetDate || null,
      updated_at:       new Date().toISOString(),
    }

    let newGoal: ClientGoal | null = null

    if (goal?.id) {
      const { data, error: err } = await supabase
        .from('client_goals')
        .update(payload)
        .eq('id', goal.id)
        .select()
        .single()
      if (err) { setError('Kunne ikke lagre'); setSaving(false); return }
      newGoal = data as ClientGoal
    } else {
      const { data, error: err } = await supabase
        .from('client_goals')
        .insert(payload)
        .select()
        .single()
      if (err) { setError('Kunne ikke lagre'); setSaving(false); return }
      newGoal = data as ClientGoal
    }

    setGoal(newGoal)
    setShowForm(false)
    setSaving(false)
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-gray-400" />
          Mål
        </h3>
        {!showForm && (
          <button
            onClick={openForm}
            className="flex items-center gap-1 text-xs text-[#2d8653] hover:text-[#1a5c3a] font-medium"
          >
            {goal ? <Pencil className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {goal ? 'Rediger' : 'Legg til'}
          </button>
        )}
      </div>

      {showForm ? (
        <div className="p-4 space-y-3">
          <div>
            <Label className="text-xs text-gray-500 block mb-1">Målvekt (kg)</Label>
            <Input
              type="number"
              value={targetWeight}
              onChange={e => setTargetWeight(e.target.value)}
              placeholder="f.eks. 80"
              step="0.1"
              min="0"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500 block mb-1">Beskrivelse</Label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="f.eks. Gå ned 5 kg til sommeren, bygge muskelmasse..."
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-gray-500 block mb-1">Startdato</Label>
              <Input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500 block mb-1">Måldato</Label>
              <Input
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1 bg-[#2d8653] hover:bg-[#1a5c3a]">
              {saving ? 'Lagrer...' : <><Check className="w-3.5 h-3.5 mr-1" />Lagre</>}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      ) : goal ? (
        <div className="p-4 space-y-2.5">
          {goal.target_weight_kg != null && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Målvekt</span>
              <span className="text-xs font-bold text-[#1a5c3a]">{goal.target_weight_kg} kg</span>
            </div>
          )}
          {goal.description && (
            <p className="text-xs text-gray-700 leading-relaxed">{goal.description}</p>
          )}
          {(goal.start_date || goal.target_date) && (
            <div className="flex justify-between items-center text-xs text-gray-400 pt-1 border-t border-gray-50">
              {goal.start_date && <span>Fra {fmtDate(goal.start_date)}</span>}
              {goal.target_date && <span>Til {fmtDate(goal.target_date)}</span>}
            </div>
          )}
        </div>
      ) : (
        <div className="p-4">
          <p className="text-xs text-gray-400 italic">Ingen mål registrert ennå</p>
        </div>
      )}
    </div>
  )
}
