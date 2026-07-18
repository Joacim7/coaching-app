'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Plus, ClipboardList, Clock, Copy, Check, X,
  Share2, ExternalLink,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Template {
  id:             string
  name:           string
  type:           'daily' | 'weekly' | 'onboarding'
  questions:      unknown[]
  schedule_days:  number[] | null
  schedule_time:  string | null
  coach_id:       string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_ABBR = ['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø']

function formatSchedule(days: number[] | null, time: string | null): string | null {
  if (!days?.length && !time) return null
  const daysStr = days?.length
    ? [...days].sort((a, b) => a - b).map(d => DAY_ABBR[d]).join(', ')
    : null
  const timeStr = time ? time.slice(0, 5) : null
  return [daysStr, timeStr].filter(Boolean).join(' · ')
}

function intakeUrl(coachId: string) {
  if (typeof window === 'undefined') return `/start/${coachId}`
  return `${window.location.origin}/start/${coachId}`
}

// ── Share modal ───────────────────────────────────────────────────────────────

function ShareModal({
  templateName,
  coachId,
  onClose,
}: {
  templateName: string
  coachId:      string
  onClose:      () => void
}) {
  const [copied, setCopied] = useState(false)
  const url = intakeUrl(coachId)

  function copy() {
    navigator.clipboard.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Del skjema</h2>
            <p className="text-xs text-gray-400 mt-0.5">{templateName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-500">
            Del denne lenken med potensielle klienter. Når noen fyller ut skjemaet dukker
            de automatisk opp som en lead med status <span className="font-semibold text-[#1a5c3a]">Ny</span>.
          </p>

          {/* URL row */}
          <div className="flex items-stretch gap-2">
            <div className="flex-1 flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 min-w-0">
              <span className="text-sm text-gray-600 truncate font-mono">{url}</span>
            </div>
            <button
              onClick={copy}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold shrink-0 transition-colors ${
                copied
                  ? 'bg-[#1a5c3a] text-white'
                  : 'bg-[#2d8653] hover:bg-[#1a5c3a] text-white'
              }`}
            >
              {copied
                ? <><Check className="w-4 h-4" />Kopiert</>
                : <><Copy className="w-4 h-4" />Kopier</>
              }
            </button>
          </div>

          {/* Preview link */}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-[#2d8653] hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Forhåndsvis skjemaet
          </a>
        </div>

        <div className="px-6 pb-5">
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

// ── Template list ─────────────────────────────────────────────────────────────

export function TemplateList({
  templates,
  coachId,
  sharedSet,
}: {
  templates: Template[]
  coachId:   string
  sharedSet: Set<string>
}) {
  const [shareModal,     setShareModal]     = useState<Template | null>(null)
  const [copiedId,       setCopiedId]       = useState<string | null>(null)

  function handleCopy(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const url = intakeUrl(coachId)
    navigator.clipboard.writeText(url).catch(() => {})
    setCopiedId('copying')
    setTimeout(() => setCopiedId(null), 2000)
  }

  function handleShare(e: React.MouseEvent, template: Template) {
    e.preventDefault()
    e.stopPropagation()
    setShareModal(template)
  }

  if (!templates.length) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Ingen maler ennå</h3>
          <p className="text-gray-500 text-sm mb-6">
            Lag din første check-in mal for å begynne å samle inn data
          </p>
          <Link
            href="/check-in-templates/new"
            className="inline-flex items-center gap-2 h-9 px-4 text-white text-sm font-semibold rounded-lg transition-all [background:linear-gradient(to_right,#1a5c3a,#6ecfb0)] hover:[background:#1a5c3a]"
          >
            <Plus className="w-4 h-4" />
            Lag mal
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="grid gap-4">
        {templates.map(template => {
          const isOnboarding = template.type === 'onboarding'
          const sched = template.type === 'weekly'
            ? formatSchedule(template.schedule_days, template.schedule_time)
            : null

          return (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex items-center gap-4">

                {/* Left — clickable area navigates to editor */}
                <Link
                  href={`/check-in-templates/${template.id}`}
                  className="flex items-center gap-4 flex-1 min-w-0"
                >
                  <div className="w-10 h-10 bg-[#cdeee3] rounded-xl flex items-center justify-center shrink-0">
                    <ClipboardList className="w-5 h-5 text-[#2d8653]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 truncate">{template.name}</p>
                      {sharedSet.has(template.id) && template.coach_id !== coachId && (
                        <Badge variant="secondary" className="text-xs shrink-0">Delt</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {template.questions?.length ?? 0} spørsmål
                    </p>
                    {sched && (
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {sched}
                      </p>
                    )}
                  </div>
                </Link>

                {/* Right — actions + badge */}
                <div className="flex items-center gap-2 shrink-0">
                  {isOnboarding && (
                    <>
                      {/* Inline copy button */}
                      <button
                        onClick={handleCopy}
                        title="Kopier lenke til oppstartsskjema"
                        className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${
                          copiedId === 'copying'
                            ? 'bg-[#cdeee3] text-[#1a5c3a]'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {copiedId === 'copying'
                          ? <><Check className="w-3.5 h-3.5" />Kopiert</>
                          : <><Copy className="w-3.5 h-3.5" />Kopier link</>
                        }
                      </button>

                      {/* Del skjema button */}
                      <button
                        onClick={e => handleShare(e, template)}
                        title="Del oppstartsskjema"
                        className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-[#ebf5ef] text-[#1a5c3a] hover:bg-[#cdeee3] transition-colors"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        Del skjema
                      </button>
                    </>
                  )}

                  <Badge variant={
                    template.type === 'daily'    ? 'default'   :
                    template.type === 'onboarding' ? 'warning' : 'secondary'
                  }>
                    {template.type === 'daily'      ? 'Daglig'   :
                     template.type === 'onboarding' ? 'Oppstart' : 'Ukentlig'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {shareModal && (
        <ShareModal
          templateName={shareModal.name}
          coachId={coachId}
          onClose={() => setShareModal(null)}
        />
      )}
    </>
  )
}
