'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  ChevronLeft, ChevronRight, X, MessageSquare,
  Link as LinkIcon, ExternalLink, CheckCircle2, Bell,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Question { id: string; text: string; type: string }

export interface ClientRow {
  id:    string
  name:  string
  email: string | null
  checkin: {
    id:         string
    created_at: string
    answers:    Record<string, string | number | boolean>
    template:   { name: string; questions: Question[] } | null
  } | null
  feedback: {
    comment:     string | null
    video_link:  string | null
    is_complete: boolean
    viewed_at:   string | null
  } | null
}

type Status = 'ikke_levert' | 'levert' | 'arbeid_pagar' | 'ferdig'

function getStatus(row: ClientRow): Status {
  if (!row.checkin)                  return 'ikke_levert'
  if (!row.feedback?.viewed_at)      return 'levert'        // submitted but coach hasn't opened it
  if (row.feedback.is_complete)      return 'ferdig'
  return 'arbeid_pagar'                                      // opened, not yet done
}

// ── Avatar helpers ─────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-[#cdeee3]   text-[#1a5c3a]',
  'bg-[#cdeee3] text-[#1a5c3a]',
  'bg-[#cdeee3] text-[#1a5c3a]',
  'bg-amber-100  text-amber-700',
  'bg-rose-100   text-rose-700',
  'bg-cyan-100   text-cyan-700',
  'bg-[#cdeee3] text-[#1a5c3a]',
]
function avatarColor(name: string) {
  const sum = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('nb-NO', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Column config ──────────────────────────────────────────────────────────────

const COLUMNS: Array<{
  key:    Status
  label:  string
  dot:    string
  ring:   string
  badge:  string
}> = [
  { key: 'ikke_levert', label: 'Ikke levert',  dot: 'bg-red-500',    ring: 'ring-red-100',    badge: 'bg-red-50    text-red-700'    },
  { key: 'levert',      label: 'Levert',        dot: 'bg-yellow-400', ring: 'ring-yellow-100', badge: 'bg-yellow-50 text-yellow-700' },
  { key: 'arbeid_pagar',label: 'Arbeid pågår',  dot: 'bg-[#2d8653]',   ring: 'ring-[#cdeee3]',   badge: 'bg-[#ebf5ef]   text-[#1a5c3a]'   },
  { key: 'ferdig',      label: 'Ferdig',        dot: 'bg-[#2d8653]',  ring: 'ring-[#cdeee3]',  badge: 'bg-[#ebf5ef] text-[#1a5c3a]'  },
]

// ── Answer renderer ────────────────────────────────────────────────────────────

function AnswerValue({ value, type }: { value: string | number | boolean; type: string }) {
  if (type === 'yesno') {
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
        value === 'Ja' || value === true ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'
      }`}>{String(value)}</span>
    )
  }
  if (type === 'scale') {
    const n   = Number(value)
    const pct = ((n - 1) / 9) * 100
    const bar = n <= 3 ? 'bg-red-400' : n <= 6 ? 'bg-amber-400' : 'bg-green-400'
    return (
      <div className="flex items-center gap-2 mt-1">
        <span className="text-sm font-bold text-gray-900 w-4 shrink-0">{n}</span>
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-gray-400">/ 10</span>
      </div>
    )
  }
  return <span className="text-sm text-gray-900">{String(value)}</span>
}

// ── Feedback modal ─────────────────────────────────────────────────────────────

function FeedbackModal({
  row,
  onClose,
  onUpdated,
}: {
  row:       ClientRow
  onClose:   () => void
  onUpdated: (id: string, feedback: NonNullable<ClientRow['feedback']>) => void
}) {
  const checkin   = row.checkin!
  const questions = checkin.template?.questions ?? []

  const [comment,    setComment]    = useState(row.feedback?.comment    ?? '')
  const [videoLink,  setVideoLink]  = useState(row.feedback?.video_link ?? '')
  const [saving,     setSaving]     = useState(false)
  const [completing, setCompleting] = useState(false)
  const [error,      setError]      = useState('')

  async function save(isComplete: boolean) {
    const setter = isComplete ? setCompleting : setSaving
    setter(true)
    setError('')

    const res = await fetch(`/api/checkin-feedback/${checkin.id}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        comment:    comment.trim(),
        videoLink:  videoLink.trim(),
        isComplete,
      }),
    })

    setter(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Kunne ikke lagre')
      return
    }

    onUpdated(row.id, {
      comment:     comment.trim()   || null,
      video_link:  videoLink.trim() || null,
      is_complete: isComplete,
      viewed_at:   row.feedback?.viewed_at ?? new Date().toISOString(),
    })
    if (isComplete) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarColor(row.name)}`}>
              {initials(row.name)}
            </div>
            <div>
              <Link
                href={`/clients/${row.id}`}
                className="font-semibold text-gray-900 text-sm hover:text-[#2d8653] hover:underline"
                onClick={onClose}
              >
                {row.name}
              </Link>
              <p className="text-xs text-gray-400 capitalize mt-0.5">{shortDate(checkin.created_at)}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-0.5 ml-4 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">

          {/* Answers */}
          <div className="px-6 py-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              {checkin.template?.name ?? 'Svar'}
            </p>
            {questions.length > 0 && Object.keys(checkin.answers).length > 0 ? (
              <div className="space-y-5">
                {questions.map((q, i) => {
                  const val = checkin.answers[q.id]
                  if (val == null) return null
                  return (
                    <div key={q.id}>
                      <p className="text-xs font-medium text-gray-500 mb-1">
                        {i + 1}. {q.text}
                      </p>
                      <AnswerValue value={val} type={q.type} />
                    </div>
                  )
                })}
              </div>
            ) : Object.keys(checkin.answers).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(checkin.answers).map(([k, v]) => (
                  <div key={k}>
                    <p className="text-xs text-gray-500">{k}</p>
                    <p className="text-sm text-gray-900">{String(v)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Ingen svar registrert</p>
            )}
          </div>

          {/* Feedback fields */}
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-gray-400" />
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Coach tilbakemelding</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Kommentar</label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={4}
                placeholder="Skriv en kommentar til klienten..."
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                <span className="flex items-center gap-1.5"><LinkIcon className="w-3 h-3" />Video link</span>
              </label>
              <input
                type="url"
                value={videoLink}
                onChange={e => setVideoLink(e.target.value)}
                placeholder="https://..."
                className="w-full h-10 px-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
              />
              {videoLink && (
                <a href={videoLink} target="_blank" rel="noopener noreferrer"
                   className="inline-flex items-center gap-1 text-xs text-[#2d8653] hover:underline mt-1">
                  <ExternalLink className="w-3 h-3" />Åpne video
                </a>
              )}
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex gap-2">
          <button
            onClick={() => save(false)}
            disabled={saving || completing}
            className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Lagrer...' : 'Lagre'}
          </button>
          <button
            onClick={() => save(true)}
            disabled={saving || completing}
            className="flex-1 h-10 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 [background:linear-gradient(to_right,#1a5c3a,#6ecfb0)] hover:[background:#1a5c3a]"
          >
            <CheckCircle2 className="w-4 h-4" />
            {completing ? 'Fullfører...' : 'Marker ferdig'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Client card ────────────────────────────────────────────────────────────────

function ClientCard({
  row,
  onOpen,
}: {
  row:    ClientRow
  onOpen: (row: ClientRow) => void
}) {
  const status = getStatus(row)
  const [reminded,  setReminded]  = useState(false)
  const [reminding, setReminding] = useState(false)
  const [, startTransition] = useTransition()

  async function handleRemind() {
    setReminding(true)
    await fetch('/api/send-checkin-reminder', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ clientId: row.id }),
    })
    setReminding(false)
    setReminded(true)
    startTransition(() => { setTimeout(() => setReminded(false), 3000) })
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3 hover:shadow-sm transition-shadow">
      {/* Avatar */}
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarColor(row.name)}`}>
        {initials(row.name)}
      </div>

      {/* Name + date */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/clients/${row.id}`}
          className="text-sm font-semibold text-gray-900 hover:text-[#2d8653] hover:underline truncate block"
        >
          {row.name}
        </Link>
        <p className="text-xs text-gray-400 mt-0.5">
          {row.checkin ? shortDate(row.checkin.created_at) : 'Ingen innlevering'}
        </p>
      </div>

      {/* Action */}
      <div className="shrink-0">
        {status === 'ikke_levert' ? (
          <button
            onClick={handleRemind}
            disabled={reminding || reminded || !row.email}
            title={!row.email ? 'Ingen e-post registrert' : undefined}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              reminded
                ? 'bg-[#cdeee3] text-[#1a5c3a]'
                : !row.email
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
            }`}
          >
            {reminded
              ? <><CheckCircle2 className="w-3.5 h-3.5" />Sendt</>
              : <><Bell className="w-3.5 h-3.5" />{reminding ? '...' : 'Påminn'}</>
            }
          </button>
        ) : (
          <button
            onClick={() => onOpen(row)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#ebf5ef] text-[#1a5c3a] hover:bg-[#cdeee3] transition-colors"
          >
            Åpne
          </button>
        )}
      </div>
    </div>
  )
}

// ── Summary bar ────────────────────────────────────────────────────────────────

function SummaryBar({ rows }: { rows: ClientRow[] }) {
  const counts = { ikke_levert: 0, levert: 0, arbeid_pagar: 0, ferdig: 0 } as Record<Status, number>
  for (const r of rows) counts[getStatus(r)]++
  const total = rows.length

  return (
    <div className="grid grid-cols-4 gap-3">
      {COLUMNS.map(col => (
        <div key={col.key} className={`rounded-xl px-4 py-3 ring-1 ${col.ring} bg-white`}>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full shrink-0 ${col.dot}`} />
            <span className="text-xs font-medium text-gray-500 truncate">{col.label}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{counts[col.key]}</p>
          {total > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              {Math.round((counts[col.key] / total) * 100)}%
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function WeeklyOverviewView({
  rows: initialRows,
  weekLabel,
  weekOffset,
  isCurrentWeek,
}: {
  rows:          ClientRow[]
  weekLabel:     string
  weekOffset:    number
  isCurrentWeek: boolean
}) {
  const [rows,  setRows]  = useState(initialRows)
  const [modal, setModal] = useState<ClientRow | null>(null)

  // Opens the modal and stamps viewed_at on first open
  function handleOpen(row: ClientRow) {
    if (!row.checkin) return

    if (!row.feedback?.viewed_at) {
      const viewed_at = new Date().toISOString()
      const updatedFeedback: NonNullable<ClientRow['feedback']> = row.feedback
        ? { ...row.feedback, viewed_at }
        : { comment: null, video_link: null, is_complete: false, viewed_at }

      const updatedRow = { ...row, feedback: updatedFeedback }
      setRows(prev => prev.map(r => r.id === row.id ? updatedRow : r))
      setModal(updatedRow)

      // Persist in background — status transition is already reflected optimistically
      fetch(`/api/checkin-feedback/${row.checkin.id}/view`, { method: 'POST' }).catch(() => {})
    } else {
      setModal(row)
    }
  }

  function handleUpdated(id: string, feedback: NonNullable<ClientRow['feedback']>) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, feedback } : r))
    setModal(m => m?.id === id ? { ...m, feedback } : m)
  }

  const grouped = Object.fromEntries(
    COLUMNS.map(col => [col.key, rows.filter(r => getStatus(r) === col.key)])
  ) as Record<Status, ClientRow[]>

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a5c3a]">Ukentlig check-in oversikt</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Spor og gjennomgå klientenes ukentlige check-ins
          </p>
        </div>

        {/* Week navigation */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
          <Link
            href={`?w=${weekOffset - 1}`}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <span className="text-sm font-semibold text-gray-700 min-w-[160px] text-center">
            {weekLabel}
          </span>
          <Link
            href={`?w=${weekOffset + 1}`}
            className={`p-1 rounded-lg transition-colors ${
              isCurrentWeek
                ? 'text-gray-200 pointer-events-none'
                : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Summary counts */}
      {rows.length > 0 && <SummaryBar rows={rows} />}

      {/* Empty state */}
      {rows.length === 0 && (
        <div className="border border-gray-100 rounded-2xl py-16 text-center bg-white">
          <CheckCircle2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Ingen aktive klienter</p>
          <p className="text-sm text-gray-400 mt-1">Legg til klienter for å se oversikten her</p>
        </div>
      )}

      {/* Kanban columns */}
      {rows.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {COLUMNS.map(col => (
            <div key={col.key}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${col.dot}`} />
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  {col.label}
                </span>
                <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${col.badge}`}>
                  {grouped[col.key].length}
                </span>
              </div>

              <div className="space-y-2">
                {grouped[col.key].length === 0 ? (
                  <div className="border border-dashed border-gray-200 rounded-xl py-6 text-center">
                    <p className="text-xs text-gray-400">Ingen</p>
                  </div>
                ) : (
                  grouped[col.key].map(row => (
                    <ClientCard key={row.id} row={row} onOpen={handleOpen} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal?.checkin && (
        <FeedbackModal
          row={modal}
          onClose={() => setModal(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  )
}
