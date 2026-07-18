'use client'

import { useState } from 'react'
import { CheckCircle2, AlertCircle } from 'lucide-react'

interface Question { id: string; text: string; type: string; required?: boolean }

interface Template {
  id:        string
  name:      string
  questions: Question[]
}

function isBlank(val: string | undefined) {
  return !val || val.trim() === ''
}

// ── Sub-inputs ────────────────────────────────────────────────────────────────

function ScaleInput({
  value, onChange, hasError,
}: { value: string; onChange: (v: string) => void; hasError: boolean }) {
  const n = value ? parseInt(value, 10) : null
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-gray-400">
        <span>Lavt</span><span>Høyt</span>
      </div>
      <div className={`flex gap-1.5 p-1 rounded-xl ${hasError ? 'ring-2 ring-red-300' : ''}`}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (
          <button
            key={num}
            type="button"
            onClick={() => onChange(String(num))}
            className={`flex-1 h-9 rounded-lg text-sm font-semibold transition-colors ${
              n === num
                ? 'bg-[#2d8653] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {num}
          </button>
        ))}
      </div>
    </div>
  )
}

function YesNoInput({
  value, onChange, hasError,
}: { value: string; onChange: (v: string) => void; hasError: boolean }) {
  return (
    <div className={`flex gap-3 ${hasError ? 'p-1 rounded-xl ring-2 ring-red-300' : ''}`}>
      {['Ja', 'Nei'].map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`flex-1 h-10 rounded-xl text-sm font-semibold transition-colors ${
            value === opt
              ? 'bg-[#2d8653] text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

// ── Main form ─────────────────────────────────────────────────────────────────

export function IntakeForm({
  coachId,
  template,
}: {
  coachId:  string
  template: Template | null
}) {
  const [name,        setName]        = useState('')
  const [email,       setEmail]       = useState('')
  const [phone,       setPhone]       = useState('')
  const [answers,     setAnswers]     = useState<Record<string, string>>({})
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState('')
  const [fieldErrors, setFieldErrors] = useState<Set<string>>(new Set())
  const [submitted,   setSubmitted]   = useState(false)

  function setAnswer(id: string, value: string) {
    setAnswers(prev => ({ ...prev, [id]: value }))
    // Clear per-field error as soon as the user makes a selection
    setFieldErrors(prev => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Validate name
    if (!name.trim()) { setError('Navn er påkrevd'); return }

    // Validate required template questions
    const missing = new Set<string>()
    for (const q of (template?.questions ?? [])) {
      if (q.required && isBlank(answers[q.id])) {
        missing.add(q.id)
      }
    }
    if (missing.size > 0) {
      setFieldErrors(missing)
      setError('Fyll ut alle påkrevde felt')
      return
    }

    setSubmitting(true)
    setError('')
    setFieldErrors(new Set())

    // Build form_answers keyed by question text (more readable for coach)
    const formAnswers: Record<string, string> = {}
    for (const q of (template?.questions ?? [])) {
      if (!isBlank(answers[q.id])) {
        formAnswers[q.text] = answers[q.id]
      }
    }

    const res = await fetch(`/api/intake/${coachId}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        name,
        email: email || undefined,
        phone: phone || undefined,
        formAnswers: Object.keys(formAnswers).length > 0 ? formAnswers : undefined,
      }),
    })
    setSubmitting(false)

    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Noe gikk galt, prøv igjen')
      return
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-7 h-7 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Takk!</h2>
        <p className="text-gray-500 text-sm">
          Vi har mottatt informasjonen din og tar kontakt snart.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">

      {/* Contact fields */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Navn *</label>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); if (error === 'Navn er påkrevd') setError('') }}
            placeholder="Ola Nordmann"
            className="w-full h-11 px-4 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">E-post</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="ola@example.com"
            className="w-full h-11 px-4 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Telefon</label>
          <input
            type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="123 45 678"
            className="w-full h-11 px-4 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
          />
        </div>
      </div>

      {/* Template questions */}
      {template && template.questions.length > 0 && (
        <div className="space-y-6 border-t border-gray-100 pt-6">
          {template.questions.map((q, i) => {
            const hasError = fieldErrors.has(q.id)
            return (
              <div key={q.id}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {i + 1}. {q.text}
                  {q.required && (
                    <span className="ml-1 text-red-500" aria-label="Påkrevd">*</span>
                  )}
                </label>

                {q.type === 'scale' && (
                  <ScaleInput
                    value={answers[q.id] ?? ''}
                    onChange={v => setAnswer(q.id, v)}
                    hasError={hasError}
                  />
                )}
                {q.type === 'yesno' && (
                  <YesNoInput
                    value={answers[q.id] ?? ''}
                    onChange={v => setAnswer(q.id, v)}
                    hasError={hasError}
                  />
                )}
                {q.type === 'text' && (
                  <textarea
                    value={answers[q.id] ?? ''}
                    onChange={e => setAnswer(q.id, e.target.value)}
                    rows={3}
                    placeholder="Skriv svaret ditt her..."
                    className={`w-full px-4 py-3 text-sm border rounded-xl resize-none focus:outline-none focus:ring-2 ${
                      hasError
                        ? 'border-red-300 focus:ring-red-400'
                        : 'border-gray-200 focus:ring-[#2d8653]'
                    }`}
                  />
                )}

                {hasError && (
                  <p className="flex items-center gap-1.5 text-xs text-red-600 mt-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Dette feltet er påkrevd
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {error && (
        <p className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full h-12 bg-[#2d8653] hover:bg-[#2d8653] text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors"
      >
        {submitting ? 'Sender...' : 'Send inn'}
      </button>
    </form>
  )
}
