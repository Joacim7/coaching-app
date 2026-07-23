'use client'

import { X, CheckCircle2 } from 'lucide-react'
import type { CheckinQuestion } from '@coaching/types'

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

const AVATAR_COLORS = [
  'bg-[#cdeee3] text-[#1a5c3a]',
  'bg-[#cdeee3] text-[#1a5c3a]',
  'bg-[#cdeee3] text-[#1a5c3a]',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-[#cdeee3] text-[#1a5c3a]',
]
function avatarColor(name: string) {
  const sum = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 2)   return 'Akkurat nå'
  if (mins < 60)  return `${mins} min siden`
  const hrs = Math.floor(mins / 60)
  if (hrs  < 24)  return `${hrs}t siden`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'I går'
  if (days  < 7)  return `${days} dager siden`
  if (days  < 30) return `${Math.floor(days / 7)} uke${Math.floor(days / 7) > 1 ? 'r' : ''} siden`
  return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
}

export function OnboardingAnswersModal({
  clientName,
  submittedAt,
  templateName,
  answers,
  questions,
  onClose,
}: {
  clientName:   string
  submittedAt:  string
  templateName: string | null
  answers:      Record<string, unknown>
  questions:    CheckinQuestion[]
  onClose:      () => void
}) {
  const questionMap = new Map(questions.map(q => [q.id, q]))
  const entries = Object.entries(answers)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarColor(clientName)}`}>
              {initials(clientName)}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{clientName}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                <CheckCircle2 className="w-3 h-3 inline mr-1 text-green-500" />
                Fullført {relTime(submittedAt)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Template name */}
        {templateName && (
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 shrink-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{templateName}</p>
          </div>
        )}

        {/* Answers */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {entries.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-6">Ingen svar registrert</p>
          ) : (
            <div className="space-y-5">
              {entries.map(([key, value], i) => {
                const q = questionMap.get(key)
                const label = q ? q.text : key
                const type  = q?.type ?? 'text'
                return (
                  <div key={key}>
                    <p className="text-xs font-medium text-gray-500 mb-1.5">
                      {i + 1}. {label}
                    </p>
                    {type === 'scale' ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900 w-5 shrink-0">{String(value)}</span>
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              Number(value) <= 3 ? 'bg-red-400' : Number(value) <= 6 ? 'bg-amber-400' : 'bg-green-400'
                            }`}
                            style={{ width: `${((Number(value) - 1) / 9) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">/ 10</span>
                      </div>
                    ) : type === 'yesno' ? (
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        String(value) === 'Ja'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-50 text-red-600'
                      }`}>
                        {String(value)}
                      </span>
                    ) : (
                      <p className="text-sm text-gray-900 bg-gray-50 rounded-xl px-3 py-2.5 whitespace-pre-wrap">
                        {String(value)}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Lukk
          </button>
        </div>
      </div>
    </div>
  )
}
