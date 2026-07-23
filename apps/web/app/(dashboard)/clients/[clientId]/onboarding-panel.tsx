'use client'

import { useState } from 'react'
import { ClipboardList, CheckCircle2, Send } from 'lucide-react'
import type { CheckinQuestion } from '@coaching/types'
import { OnboardingAnswersModal } from '@/components/onboarding-answers-modal'

export interface OnboardingSubmissionInfo {
  submitted_at: string
  answers: Record<string, unknown>
}

interface Props {
  clientId: string
  clientName: string
  templateName: string | null
  templateQuestions: CheckinQuestion[]
  submission: OnboardingSubmissionInfo | null
}

export function OnboardingPanel({
  clientId,
  clientName,
  templateName,
  templateQuestions,
  submission,
}: Props) {
  const [showModal, setShowModal] = useState(false)
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null)

  const completed = submission !== null

  async function handleResend() {
    setSending(true)
    setFeedback(null)
    const res = await fetch(`/api/clients/${clientId}/resend-onboarding`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setSending(false)
    setFeedback(
      res.ok
        ? { ok: true, message: 'Skjema sendt på nytt' }
        : { ok: false, message: data.error ?? 'Kunne ikke sende skjema' }
    )
    setTimeout(() => setFeedback(null), 4000)
  }

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      <div className="px-4 py-3.5 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
          <ClipboardList className="w-3.5 h-3.5 text-gray-400" />
          Onboarding
        </h3>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">Status</span>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
              completed ? 'bg-[#ebf5ef] text-[#1a5c3a]' : 'bg-gray-100 text-gray-500'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${completed ? 'bg-[#2d8653]' : 'bg-gray-300'}`} />
            {completed ? 'Fullført' : 'Ikke sendt'}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">Skjema</span>
          <span className="text-xs font-semibold text-gray-900 truncate max-w-[60%] text-right">
            {templateName ?? '—'}
          </span>
        </div>

        {feedback && (
          <p className={`text-xs font-medium ${feedback.ok ? 'text-[#2d8653]' : 'text-red-500'}`}>
            {feedback.message}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setShowModal(true)}
            disabled={!completed}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-xl text-xs font-semibold bg-[#ebf5ef] text-[#1a5c3a] hover:bg-[#cdeee3] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Se svar
          </button>
          <button
            onClick={handleResend}
            disabled={sending}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-xl text-xs font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            {sending ? 'Sender...' : 'Send på nytt'}
          </button>
        </div>
      </div>

      {showModal && submission && (
        <OnboardingAnswersModal
          clientName={clientName}
          submittedAt={submission.submitted_at}
          templateName={templateName}
          answers={submission.answers}
          questions={templateQuestions}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
