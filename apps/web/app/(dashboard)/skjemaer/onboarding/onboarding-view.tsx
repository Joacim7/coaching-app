'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Bell, Search, X, CheckCircle2, Clock, Minus } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Question { id: string; text: string; type: string }

export interface ClientOnboardingRow {
  clientId:     string
  name:         string
  email:        string | null
  status:       'fullfort' | 'venter' | 'ikke_sendt'
  templateName: string | null
  submission: {
    id:           string
    submitted_at: string
    answers:      Record<string, unknown>
  } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
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

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CFG = {
  fullfort:   { label: 'Fullført',   dot: 'bg-[#2d8653]', bg: 'bg-[#ebf5ef]', text: 'text-[#1a5c3a]' },
  venter:     { label: 'Venter',     dot: 'bg-yellow-400',bg: 'bg-yellow-50', text: 'text-yellow-700' },
  ikke_sendt: { label: 'Ikke sendt', dot: 'bg-gray-300',  bg: 'bg-gray-100',  text: 'text-gray-500'  },
} as const

function StatusBadge({ status }: { status: ClientOnboardingRow['status'] }) {
  const { label, dot, bg, text } = STATUS_CFG[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${bg} ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  )
}

// ── Answers modal ─────────────────────────────────────────────────────────────

function AnswersModal({
  row,
  questions,
  onClose,
}: {
  row:       ClientOnboardingRow
  questions: Question[]
  onClose:   () => void
}) {
  const sub = row.submission!
  const questionMap = new Map(questions.map(q => [q.id, q]))

  const entries = Object.entries(sub.answers)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarColor(row.name)}`}>
              {initials(row.name)}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{row.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                <CheckCircle2 className="w-3 h-3 inline mr-1 text-green-500" />
                Fullført {relTime(sub.submitted_at)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Template name */}
        {row.templateName && (
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 shrink-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{row.templateName}</p>
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

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, count, total, color }: {
  label: string; count: number; total: number; color: string
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <p className="text-3xl font-bold text-gray-900">{count}</p>
      {total > 0 && label !== 'Alle klienter' && (
        <div className="mt-2 space-y-1">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-gray-400">{pct}%</p>
        </div>
      )}
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function OnboardingView({
  rows,
  templateQuestions,
}: {
  rows:              ClientOnboardingRow[]
  templateQuestions: Question[]
}) {
  const router  = useRouter()
  const [search,   setSearch]   = useState('')
  const [modal,    setModal]    = useState<ClientOnboardingRow | null>(null)
  const [sending,  setSending]  = useState(false)
  const [sentMsg,  setSentMsg]  = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const waitingCount = rows.filter(r => r.status === 'venter').length
  const fullfortCount = rows.filter(r => r.status === 'fullfort').length
  const ikkeSentCount = rows.filter(r => r.status === 'ikke_sendt').length

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (r.email ?? '').toLowerCase().includes(q)
    )
  }, [rows, search])

  async function handleRefresh() {
    setRefreshing(true)
    router.refresh()
    setTimeout(() => setRefreshing(false), 800)
  }

  async function handleSendReminders() {
    setSending(true)
    setSentMsg(null)
    const res = await fetch('/api/send-onboarding-reminder', { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setSending(false)
    if (res.ok) {
      setSentMsg(data.sent > 0 ? `${data.sent} påminnelse${data.sent > 1 ? 'r' : ''} sendt` : 'Ingen e-poster å sende')
      setTimeout(() => setSentMsg(null), 4000)
    }
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a5c3a]">Onboarding-innsendinger</h1>
          <p className="text-sm text-gray-500 mt-1">
            Følg opp og administrer klientenes onboarding-skjemaer
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Oppdater data
          </button>
          <button
            onClick={handleSendReminders}
            disabled={sending || waitingCount === 0}
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-all [background:linear-gradient(to_right,#1a5c3a,#6ecfb0)] hover:[background:#1a5c3a]"
          >
            <Bell className="w-3.5 h-3.5" />
            {sending ? 'Sender...' : `Send påminnelser (${waitingCount})`}
          </button>
        </div>
      </div>

      {/* Sent confirmation */}
      {sentMsg && (
        <div className="flex items-center gap-2 bg-[#ebf5ef] border border-[#cdeee3] rounded-xl px-4 py-2.5 text-sm text-[#1a5c3a] font-medium">
          <CheckCircle2 className="w-4 h-4" />
          {sentMsg}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Alle klienter" count={rows.length}    total={rows.length} color="" />
        <StatCard label="Fullført"      count={fullfortCount}  total={rows.length} color="bg-[#2d8653]" />
        <StatCard label="Venter"        count={waitingCount}   total={rows.length} color="bg-yellow-400" />
        <StatCard label="Ikke sendt"    count={ikkeSentCount}  total={rows.length} color="bg-gray-300" />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Søk etter klient..."
          className="w-full h-10 pl-10 pr-4 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d8653] bg-white"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="border border-gray-100 rounded-2xl py-16 text-center bg-white">
          <Clock className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Ingen klienter ennå</p>
          <p className="text-sm text-gray-400 mt-1">Legg til klienter for å se onboarding-status her</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-gray-100 rounded-2xl py-12 text-center bg-white">
          <p className="text-gray-500 text-sm">Ingen klienter matcher søket</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">Klient</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">Skjema</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">Sendt inn</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">Handlinger</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(row => (
                <tr key={row.clientId} className="hover:bg-gray-50/50 transition-colors">

                  {/* Klient */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(row.name)}`}>
                        {initials(row.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{row.name}</p>
                        <p className="text-xs text-gray-400 truncate">{row.email ?? '—'}</p>
                      </div>
                    </div>
                  </td>

                  {/* Skjema */}
                  <td className="px-5 py-3.5 text-sm text-gray-600">
                    {row.templateName ?? <span className="text-gray-300">—</span>}
                  </td>

                  {/* Status */}
                  <td className="px-5 py-3.5">
                    <StatusBadge status={row.status} />
                  </td>

                  {/* Sendt inn */}
                  <td className="px-5 py-3.5 text-sm text-gray-500">
                    {row.submission
                      ? relTime(row.submission.submitted_at)
                      : <Minus className="w-4 h-4 text-gray-300" />
                    }
                  </td>

                  {/* Handlinger */}
                  <td className="px-5 py-3.5">
                    {row.submission ? (
                      <button
                        onClick={() => setModal(row)}
                        className="h-7 px-3 rounded-lg text-xs font-semibold bg-[#ebf5ef] text-[#1a5c3a] hover:bg-[#cdeee3] transition-colors"
                      >
                        Se svar
                      </button>
                    ) : (
                      <Minus className="w-4 h-4 text-gray-300" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Answers modal */}
      {modal?.submission && (
        <AnswersModal
          row={modal}
          questions={templateQuestions}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
