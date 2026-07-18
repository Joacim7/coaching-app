'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { CheckinTemplate, CheckinQuestion } from '@coaching/types'

interface Props {
  token: string
  clientId: string
  template: CheckinTemplate
}

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: CheckinQuestion
  value: string
  onChange: (v: string) => void
}) {
  if (question.type === 'scale') {
    return (
      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-2">
          <span>1 – Veldig dårlig</span>
          <span>10 – Veldig bra</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {[1,2,3,4,5,6,7,8,9,10].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(String(n))}
              className={`w-10 h-10 rounded-xl font-semibold text-sm transition-all ${
                value === String(n)
                  ? 'bg-[#2d8653] text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (question.type === 'yesno') {
    return (
      <div className="flex gap-3">
        {['Ja', 'Nei'].map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`flex-1 py-3 rounded-xl font-medium text-sm transition-all ${
              value === opt
                ? 'bg-[#2d8653] text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    )
  }

  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={3}
      placeholder="Skriv svaret ditt her..."
      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2d8653] focus:border-transparent"
    />
  )
}

export default function OnboardingForm({ token, clientId, template }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  function setAnswer(id: string, value: string) {
    setAnswers(prev => ({ ...prev, [id]: value }))
  }

  const allAnswered = template.questions.every(q => answers[q.id]?.trim())

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!allAnswered) return
    setSubmitting(true)
    setError('')

    const res = await fetch(`/api/onboarding/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, templateId: template.id, answers }),
    })

    setSubmitting(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Noe gikk galt. Prøv igjen.')
      return
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Takk!</h2>
        <p className="text-gray-500 text-sm">
          Svarene dine er sendt. Treneren din ser nå svarene og tar kontakt.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-2">
        <h2 className="font-semibold text-gray-900 text-lg">{template.name}</h2>
        <p className="text-sm text-gray-400 mt-0.5">{template.questions.length} spørsmål</p>
      </div>

      {template.questions.map((q, i) => (
        <div key={q.id} className="bg-white rounded-2xl shadow-sm p-6">
          <p className="font-medium text-gray-900 mb-4">
            <span className="text-[#2d8653] mr-2 font-semibold">{i + 1}.</span>
            {q.text}
          </p>
          <QuestionInput
            question={q}
            value={answers[q.id] ?? ''}
            onChange={v => setAnswer(q.id, v)}
          />
        </div>
      ))}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
      )}

      <Button
        type="submit"
        disabled={!allAnswered || submitting}
        className="w-full h-auto py-4 rounded-2xl text-base font-semibold shadow-md"
      >
        {submitting ? 'Sender...' : 'Send svar'}
      </Button>
    </form>
  )
}
