'use client'

import { useState } from 'react'
import { CheckCircle2, X, Link as LinkIcon, MessageSquare, ExternalLink } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Question { id: string; text: string; type: string }
interface Template { name: string; questions: Question[] }
interface Feedback  { comment: string | null; video_link: string | null }

export interface CheckinRow {
  id:           string
  created_at:   string
  mood:         number | null
  type:         string
  notes:        string | null
  answers:      Record<string, string | number | boolean>
  template:     Template | null
  feedback:     Feedback | null
  weight_kg?:   number | null
  sleep_hours?: number | null
  energy_level?: number | null
  steps?:       number | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOOD = ['😢', '😞', '😐', '🙂', '😄']

function relDate(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return 'I dag'
  if (days === 1) return 'I går'
  if (days < 7)  return `${days} dager siden`
  if (days < 30) return `${Math.floor(days / 7)} uker siden`
  return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })
}

function longDate(iso: string) {
  return new Date(iso).toLocaleDateString('nb-NO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function AnswerValue({ value, type }: { value: string | number | boolean; type: string }) {
  if (type === 'yesno') {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        value === 'Ja' || value === true
          ? 'bg-green-100 text-green-700'
          : 'bg-red-50 text-red-600'
      }`}>
        {String(value)}
      </span>
    )
  }
  if (type === 'scale') {
    const n = Number(value)
    const pct = ((n - 1) / 9) * 100
    const color = n <= 3 ? 'bg-red-400' : n <= 6 ? 'bg-amber-400' : 'bg-green-400'
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-gray-900 w-4">{n}</span>
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-gray-400">/ 10</span>
      </div>
    )
  }
  return <span className="text-sm text-gray-900">{String(value)}</span>
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function CheckinModal({
  checkin,
  onClose,
  onSaved,
}: {
  checkin: CheckinRow
  onClose:  () => void
  onSaved:  (id: string, feedback: Feedback) => void
}) {
  const [comment,   setComment]   = useState(checkin.feedback?.comment    ?? '')
  const [videoLink, setVideoLink] = useState(checkin.feedback?.video_link ?? '')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [saved,     setSaved]     = useState(false)

  const questions = checkin.template?.questions ?? []
  const hasFeedback = !!(checkin.feedback?.comment || checkin.feedback?.video_link)

  async function handleSave() {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/checkin-feedback/${checkin.id}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ comment: comment.trim(), videoLink: videoLink.trim() }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Kunne ikke lagre')
      return
    }
    setSaved(true)
    onSaved(checkin.id, { comment: comment.trim() || null, video_link: videoLink.trim() || null })
    setTimeout(onClose, 900)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                checkin.type === 'daily' ? 'bg-[#cdeee3] text-[#1a5c3a]' : 'bg-[#cdeee3] text-[#1a5c3a]'
              }`}>
                {checkin.type === 'daily' ? 'Daglig' : 'Ukentlig'}
              </span>
              {checkin.template?.name && (
                <span className="text-sm text-gray-500">{checkin.template.name}</span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1 capitalize">{longDate(checkin.created_at)}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-0.5 ml-4 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Answers */}
          <div className="px-6 py-5">
            {checkin.mood != null && (
              <div className="flex items-center gap-2 mb-5 pb-4 border-b border-gray-100">
                <span className="text-2xl">{MOOD[checkin.mood - 1]}</span>
                <div>
                  <p className="text-xs text-gray-500">Humør</p>
                  <p className="text-sm font-semibold text-gray-900">{checkin.mood} / 5</p>
                </div>
              </div>
            )}

            {/* Metric values — shown for daily check-ins */}
            {(checkin.weight_kg != null || checkin.sleep_hours != null || checkin.energy_level != null || checkin.steps != null) && (
              <div className="grid grid-cols-2 gap-3 mb-5 pb-5 border-b border-gray-100">
                {checkin.weight_kg != null && (
                  <div className="bg-gray-50 rounded-xl px-4 py-3">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Vekt</p>
                    <p className="text-lg font-bold text-gray-900">{checkin.weight_kg} <span className="text-sm font-normal text-gray-500">kg</span></p>
                  </div>
                )}
                {checkin.sleep_hours != null && (
                  <div className="bg-gray-50 rounded-xl px-4 py-3">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Søvn</p>
                    <p className="text-lg font-bold text-gray-900">{checkin.sleep_hours} <span className="text-sm font-normal text-gray-500">timer</span></p>
                  </div>
                )}
                {checkin.energy_level != null && (
                  <div className="bg-gray-50 rounded-xl px-4 py-3">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Energi</p>
                    <p className="text-lg font-bold text-gray-900">{checkin.energy_level} <span className="text-sm font-normal text-gray-500">/ 10</span></p>
                  </div>
                )}
                {checkin.steps != null && (
                  <div className="bg-gray-50 rounded-xl px-4 py-3">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Skritt</p>
                    <p className="text-lg font-bold text-gray-900">{checkin.steps.toLocaleString('nb-NO')}</p>
                  </div>
                )}
              </div>
            )}

            {questions.length > 0 && Object.keys(checkin.answers).length > 0 ? (
              <div className="space-y-4">
                {questions.map((q, i) => {
                  const val = checkin.answers[q.id]
                  if (val === undefined || val === null) return null
                  return (
                    <div key={q.id}>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                        {i + 1}. {q.text}
                      </p>
                      <AnswerValue value={val} type={q.type} />
                    </div>
                  )
                })}
              </div>
            ) : Object.keys(checkin.answers).length > 0 ? (
              // No template — show raw answers
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

            {checkin.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Notater</p>
                <p className="text-sm text-gray-700">{checkin.notes}</p>
              </div>
            )}
          </div>

          {/* Coach feedback */}
          <div className="px-6 pb-6 space-y-4 border-t border-gray-100 pt-5">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900">Coach tilbakemelding</h3>
              {hasFeedback && (
                <span className="text-[10px] bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">Lagret</span>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Kommentar</label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={4}
                placeholder="Skriv en kommentar til klienten..."
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#2d8653] focus:border-transparent"
              />
            </div>

            {checkin.type === 'weekly' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <LinkIcon className="w-3 h-3" />
                    Video link
                  </span>
                </label>
                <input
                  type="url"
                  value={videoLink}
                  onChange={e => setVideoLink(e.target.value)}
                  placeholder="https://..."
                  className="w-full h-10 px-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d8653] focus:border-transparent"
                />
                {videoLink && (
                  <a
                    href={videoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[#2d8653] hover:underline mt-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Åpne video
                  </a>
                )}
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className="w-full h-10 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-all flex items-center justify-center gap-2 [background:linear-gradient(to_right,#1a5c3a,#6ecfb0)] hover:[background:#1a5c3a]"
          >
            {saved ? '✓ Lagret' : saving ? 'Lagrer...' : 'Lagre tilbakemelding'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function RecentCheckins({
  checkins: initial,
  clientId,
}: {
  checkins: CheckinRow[]
  clientId: string
}) {
  const [checkins,  setCheckins]  = useState(initial)
  const [selected,  setSelected]  = useState<CheckinRow | null>(null)

  function handleSaved(id: string, feedback: Feedback) {
    setCheckins(prev => prev.map(c => c.id === id ? { ...c, feedback } : c))
    if (selected?.id === id) setSelected(s => s ? { ...s, feedback } : s)
  }

  return (
    <>
      <div className="p-5">
        {checkins.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Ingen aktivitet registrert</p>
          </div>
        ) : (
          <div className="space-y-3">
            {checkins.map(c => (
              <div key={c.id} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-[#cdeee3] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#2d8653]" />
                </div>
                <div className="flex-1 min-w-0 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {c.type === 'daily' ? 'Daglig check-in' : 'Ukentlig check-in'}
                        {c.mood != null ? ` · ${MOOD[c.mood - 1]}` : ''}
                      </p>
                      {c.feedback?.comment || c.feedback?.video_link ? (
                        <span className="text-[10px] bg-green-100 text-green-700 font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                          Tilbakemelding gitt
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-400">{relDate(c.created_at)}</span>
                      <button
                        onClick={() => setSelected(c)}
                        className="text-xs font-medium text-[#2d8653] hover:text-[#1a5c3a] hover:underline whitespace-nowrap"
                      >
                        Se svar
                      </button>
                    </div>
                  </div>
                  {(c.weight_kg != null || c.sleep_hours != null || c.energy_level != null || c.steps != null) && (
                    <div className="flex items-center gap-3 mt-1.5">
                      {c.weight_kg    != null && <span className="text-[11px] text-gray-500">⚖️ {c.weight_kg} kg</span>}
                      {c.sleep_hours  != null && <span className="text-[11px] text-gray-500">💤 {c.sleep_hours} t</span>}
                      {c.energy_level != null && <span className="text-[11px] text-gray-500">⚡ {c.energy_level}/10</span>}
                      {c.steps        != null && <span className="text-[11px] text-gray-500">👣 {c.steps.toLocaleString('nb-NO')}</span>}
                    </div>
                  )}
                  {c.notes && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{c.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <CheckinModal
          checkin={selected}
          onClose={() => setSelected(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  )
}
