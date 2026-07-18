'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, Save, ChevronLeft, GripVertical } from 'lucide-react'
import Link from 'next/link'
import type { Exercise, TrainingSession } from '@coaching/types'

const DAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']

interface Props {
  clientId: string
  clientName: string
  coachId: string
  initialPlan: {
    id: string
    title: string
    description: string | null
    sessions: TrainingSession[]
  } | null
}

function newExercise(): Exercise {
  return {
    id: crypto.randomUUID(),
    name: '',
    sets: 3,
    reps: '8-10',
    weight: '',
    rest: '60s',
    notes: '',
  }
}

function newSession(dayOfWeek: number): TrainingSession {
  return {
    id: crypto.randomUUID(),
    training_plan_id: '',
    day_of_week: dayOfWeek,
    title: DAYS[dayOfWeek - 1],
    exercises: [newExercise()],
    created_at: new Date().toISOString(),
  }
}

export default function TrainingPlanEditor({ clientId, clientName, coachId, initialPlan }: Props) {
  const supabase = createClient()
  const [title, setTitle] = useState(initialPlan?.title ?? 'Ny treningsplan')
  const [description, setDescription] = useState(initialPlan?.description ?? '')
  const [sessions, setSessions] = useState<TrainingSession[]>(
    initialPlan?.sessions?.sort((a, b) => a.day_of_week - b.day_of_week) ?? []
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeDay, setActiveDay] = useState<number | null>(
    sessions[0]?.day_of_week ?? null
  )

  const addDay = useCallback((dayIndex: number) => {
    const dayNum = dayIndex + 1
    if (sessions.find(s => s.day_of_week === dayNum)) return
    const s = newSession(dayNum)
    setSessions(prev => [...prev, s].sort((a, b) => a.day_of_week - b.day_of_week))
    setActiveDay(dayNum)
  }, [sessions])

  const removeDay = useCallback((dayNum: number) => {
    setSessions(prev => prev.filter(s => s.day_of_week !== dayNum))
    setActiveDay(null)
  }, [])

  const updateSession = useCallback((dayNum: number, field: keyof TrainingSession, value: unknown) => {
    setSessions(prev =>
      prev.map(s => s.day_of_week === dayNum ? { ...s, [field]: value } : s)
    )
  }, [])

  const addExercise = useCallback((dayNum: number) => {
    setSessions(prev =>
      prev.map(s =>
        s.day_of_week === dayNum
          ? { ...s, exercises: [...s.exercises, newExercise()] }
          : s
      )
    )
  }, [])

  const updateExercise = useCallback((dayNum: number, exId: string, field: keyof Exercise, value: string | number) => {
    setSessions(prev =>
      prev.map(s =>
        s.day_of_week === dayNum
          ? {
              ...s,
              exercises: s.exercises.map(e =>
                e.id === exId ? { ...e, [field]: value } : e
              ),
            }
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

  async function handleSave() {
    setSaving(true)
    try {
      let planId = initialPlan?.id

      if (!planId) {
        const { data, error } = await supabase
          .from('training_plans')
          .insert({ title, description, client_id: clientId, coach_id: coachId, is_active: true })
          .select('id')
          .single()
        if (error) throw error
        planId = data.id
      } else {
        await supabase
          .from('training_plans')
          .update({ title, description })
          .eq('id', planId)
      }

      // Delete existing sessions and re-insert
      await supabase.from('training_sessions').delete().eq('training_plan_id', planId)

      if (sessions.length > 0) {
        await supabase.from('training_sessions').insert(
          sessions.map(s => ({
            training_plan_id: planId!,
            day_of_week: s.day_of_week,
            title: s.title,
            exercises: s.exercises,
          }))
        )
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const activeSession = sessions.find(s => s.day_of_week === activeDay)

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/clients/${clientId}`} className="text-gray-400 hover:text-gray-600">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <p className="text-sm text-gray-500">{clientName}</p>
          <h1 className="text-xl font-bold text-gray-900">Treningsplan</h1>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4" />
          {saved ? 'Lagret!' : saving ? 'Lagrer...' : 'Lagre'}
        </Button>
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-6">
        {/* Left: Plan details + day selector */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div>
                <Label>Plannavn</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div>
                <Label>Beskrivelse</Label>
                <Textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Kortfattet beskrivelse av planen..."
                  className="min-h-[80px]"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Treningsdager</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-1">
              {DAYS.map((day, i) => {
                const dayNum = i + 1
                const hasSession = sessions.some(s => s.day_of_week === dayNum)
                const isActive = activeDay === dayNum
                return (
                  <button
                    key={day}
                    onClick={() => hasSession ? setActiveDay(dayNum) : addDay(i)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[#2d8653] text-white'
                        : hasSession
                        ? 'bg-[#ebf5ef] text-[#1a5c3a] hover:bg-[#cdeee3]'
                        : 'text-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    <span>{day}</span>
                    {hasSession ? (
                      <span className={`text-xs ${isActive ? 'text-[#6ecfb0]' : 'text-[#6ecfb0]'}`}>
                        {sessions.find(s => s.day_of_week === dayNum)?.exercises.length ?? 0} øvelser
                      </span>
                    ) : (
                      <Plus className="w-4 h-4 opacity-40" />
                    )}
                  </button>
                )
              })}
            </CardContent>
          </Card>
        </div>

        {/* Right: Session editor */}
        <div>
          {!activeSession ? (
            <Card className="flex items-center justify-center h-64">
              <CardContent className="text-center text-gray-400">
                <p>Velg eller legg til en treningsdag</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label className="mb-1">Økt-tittel</Label>
                    <Input
                      value={activeSession.title}
                      onChange={e => updateSession(activeSession.day_of_week, 'title', e.target.value)}
                      className="max-w-xs"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDay(activeSession.day_of_week)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Fjern dag
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Header row */}
                  <div className="grid grid-cols-[1fr_60px_80px_80px_70px_1fr_36px] gap-2 text-xs text-gray-500 font-medium px-2">
                    <span>Øvelse</span>
                    <span>Sett</span>
                    <span>Reps</span>
                    <span>Vekt</span>
                    <span>Pause</span>
                    <span>Notater</span>
                    <span></span>
                  </div>

                  {activeSession.exercises.map(ex => (
                    <div
                      key={ex.id}
                      className="grid grid-cols-[1fr_60px_80px_80px_70px_1fr_36px] gap-2 items-center"
                    >
                      <Input
                        value={ex.name}
                        onChange={e => updateExercise(activeSession.day_of_week, ex.id, 'name', e.target.value)}
                        placeholder="Øvelse..."
                      />
                      <Input
                        type="number"
                        value={ex.sets}
                        onChange={e => updateExercise(activeSession.day_of_week, ex.id, 'sets', Number(e.target.value))}
                        min={1}
                      />
                      <Input
                        value={ex.reps}
                        onChange={e => updateExercise(activeSession.day_of_week, ex.id, 'reps', e.target.value)}
                        placeholder="8-10"
                      />
                      <Input
                        value={ex.weight}
                        onChange={e => updateExercise(activeSession.day_of_week, ex.id, 'weight', e.target.value)}
                        placeholder="60kg"
                      />
                      <Input
                        value={ex.rest}
                        onChange={e => updateExercise(activeSession.day_of_week, ex.id, 'rest', e.target.value)}
                        placeholder="60s"
                      />
                      <Input
                        value={ex.notes}
                        onChange={e => updateExercise(activeSession.day_of_week, ex.id, 'notes', e.target.value)}
                        placeholder="Notater..."
                      />
                      <button
                        onClick={() => removeExercise(activeSession.day_of_week, ex.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                        title="Fjern øvelse"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addExercise(activeSession.day_of_week)}
                    className="mt-2"
                  >
                    <Plus className="w-4 h-4" />
                    Legg til øvelse
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
