'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, Save, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import type { CheckinQuestion, CheckinTemplate, QuestionType } from '@coaching/types'

interface Props {
  initialTemplate?: CheckinTemplate
}

function newQuestion(): CheckinQuestion {
  return { id: crypto.randomUUID(), text: '', type: 'text' }
}

const questionTypeLabels: Record<QuestionType, string> = {
  text: 'Fritekst',
  scale: 'Skala (1–10)',
  yesno: 'Ja / Nei',
}

export default function TemplateEditor({ initialTemplate }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState(initialTemplate?.name ?? '')
  const [type, setType] = useState<'daily' | 'weekly' | 'onboarding'>(initialTemplate?.type ?? 'daily')
  const [questions, setQuestions] = useState<CheckinQuestion[]>(
    initialTemplate?.questions ?? [newQuestion()]
  )
  const [scheduleDays, setScheduleDays] = useState<number[]>(
    initialTemplate?.schedule_days ?? []
  )
  const [scheduleTime, setScheduleTime] = useState<string>(
    // Postgres returns "HH:MM:SS" — trim to "HH:MM" for the input
    initialTemplate?.schedule_time?.slice(0, 5) ?? '08:00'
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  function toggleDay(day: number) {
    setScheduleDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a, b) => a - b)
    )
  }

  async function handleSave() {
    if (!name.trim() || questions.some(q => !q.text.trim())) return
    setSaving(true)
    setSaveError('')

    try {
      // Only include schedule columns when type is weekly — avoids failures if
      // migration 020 hasn't been applied, and avoids sending unnecessary fields.
      const schedulePayload = type === 'weekly'
        ? { schedule_days: scheduleDays, schedule_time: scheduleTime || null }
        : {}

      let error
      if (initialTemplate) {
        ;({ error } = await supabase
          .from('checkin_templates')
          .update({ name, type, questions, ...schedulePayload })
          .eq('id', initialTemplate.id))
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setSaveError('Ikke innlogget'); setSaving(false); return }
        ;({ error } = await supabase.from('checkin_templates').insert({
          name,
          type,
          questions,
          coach_id: user.id,
          ...schedulePayload,
        }))
      }

      if (error) {
        console.error('[template-editor] save error:', error)
        setSaveError(error.message)
        return
      }

      router.push('/check-in-templates')
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ukjent feil'
      console.error('[template-editor] unexpected error:', err)
      setSaveError(msg)
    } finally {
      setSaving(false)
    }
  }

  function updateQuestion(id: string, field: keyof CheckinQuestion, value: string) {
    setQuestions(prev =>
      prev.map(q => (q.id === id ? { ...q, [field]: value } : q))
    )
  }

  function toggleRequired(id: string) {
    setQuestions(prev =>
      prev.map(q => (q.id === id ? { ...q, required: !q.required } : q))
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/check-in-templates" className="text-gray-400 hover:text-gray-600">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">
          {initialTemplate ? 'Rediger mal' : 'Ny check-in mal'}
        </h1>
      </div>

      <div className="space-y-6">
        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <Label>Navn på mal</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={type === 'onboarding' ? 'f.eks. Velkomstskjema' : 'f.eks. Daglig velvære-sjekk'}
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={type} onChange={e => setType(e.target.value as 'daily' | 'weekly' | 'onboarding')}>
                <option value="daily">Daglig innsjekk</option>
                <option value="weekly">Ukentlig innsjekk</option>
                <option value="onboarding">Oppstartsskjema</option>
              </Select>
            </div>
            {type === 'onboarding' && (
              <p className="text-xs text-[#2d8653] bg-[#ebf5ef] px-3 py-2 rounded-lg">
                Oppstartsskjema sendes automatisk på e-post til nye klienter når de legges til.
              </p>
            )}
          </CardContent>
        </Card>

        {type === 'weekly' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Utsendingstidspunkt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label className="mb-2 block">Dager</Label>
                <div className="flex flex-wrap gap-2">
                  {(['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø'] as const).map((label, idx) => {
                    const active = scheduleDays.includes(idx)
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleDay(idx)}
                        className={`w-10 h-10 rounded-xl text-sm font-semibold transition-colors ${
                          active
                            ? 'bg-[#2d8653] text-white shadow-sm'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
                {scheduleDays.length === 0 && (
                  <p className="text-xs text-amber-600 mt-2">Velg minst én dag</p>
                )}
              </div>

              <div>
                <Label htmlFor="scheduleTime" className="mb-2 block">Tidspunkt</Label>
                <input
                  id="scheduleTime"
                  type="time"
                  value={scheduleTime}
                  onChange={e => setScheduleTime(e.target.value)}
                  className="h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8653] bg-white"
                />
              </div>
            </CardContent>
          </Card>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Spørsmål</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuestions(prev => [...prev, newQuestion()])}
            >
              <Plus className="w-4 h-4" />
              Legg til spørsmål
            </Button>
          </div>

          <div className="space-y-3">
            {questions.map((q, i) => (
              <Card key={q.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-sm text-gray-400 font-medium mt-2.5 w-5 text-right shrink-0">
                      {i + 1}.
                    </span>
                    <div className="flex-1 space-y-2">
                      <Input
                        value={q.text}
                        onChange={e => updateQuestion(q.id, 'text', e.target.value)}
                        placeholder="Skriv spørsmål..."
                      />
                      <div className="flex items-center gap-2">
                        <Select
                          value={q.type}
                          onChange={e => updateQuestion(q.id, 'type', e.target.value)}
                          className="max-w-[180px]"
                        >
                          {Object.entries(questionTypeLabels).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </Select>
                        <button
                          type="button"
                          onClick={() => toggleRequired(q.id)}
                          className={`flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold transition-colors ${
                            q.required
                              ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-200'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {q.required ? '● Påkrevd' : 'Valgfri'}
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => setQuestions(prev => prev.filter(qu => qu.id !== q.id))}
                      className="text-gray-300 hover:text-red-500 mt-2 transition-colors"
                      disabled={questions.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {saveError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
            {saveError}
          </p>
        )}

        <div className="flex gap-3">
          <Link href="/check-in-templates">
            <Button variant="outline">Avbryt</Button>
          </Link>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            <Save className="w-4 h-4" />
            {saving ? 'Lagrer...' : 'Lagre mal'}
          </Button>
        </div>
      </div>
    </div>
  )
}
