'use client'

import { useState } from 'react'
import { X, Plus, UserPlus, Copy, Check, ChevronRight } from 'lucide-react'
import { useLocale } from '@/components/locale-provider'
import type { TranslationKey } from '@/lib/i18n/translations'

// ── Types ─────────────────────────────────────────────────────────────────────

type LeadStatus = 'ny' | 'kontaktet' | 'kvalifisert' | 'vunnet' | 'tapt'
type FilterStatus = 'all' | LeadStatus

export interface Lead {
  id:           string
  full_name:    string
  email:        string | null
  phone:        string | null
  status:       LeadStatus
  source:       string
  notes:        string | null
  form_answers: Record<string, unknown> | null
  created_at:   string
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS: Record<LeadStatus, { labelKey: TranslationKey; bg: string; text: string; dot: string }> = {
  ny:          { labelKey: 'leads.status.new',        bg: 'bg-[#ebf5ef]',    text: 'text-[#1a5c3a]',   dot: 'bg-[#6ecfb0]'   },
  kontaktet:   { labelKey: 'leads.status.contacted',  bg: 'bg-amber-50',   text: 'text-amber-700',  dot: 'bg-amber-400'  },
  kvalifisert: { labelKey: 'leads.status.qualified',  bg: 'bg-[#ebf5ef]',  text: 'text-[#1a5c3a]', dot: 'bg-[#2d8653]' },
  vunnet:      { labelKey: 'leads.status.won',        bg: 'bg-[#ebf5ef]',  text: 'text-[#1a5c3a]', dot: 'bg-[#2d8653]'  },
  tapt:        { labelKey: 'leads.status.lost',       bg: 'bg-gray-100',   text: 'text-gray-500',   dot: 'bg-gray-400'   },
}

const ALL_STATUSES: LeadStatus[] = ['ny', 'kontaktet', 'kvalifisert', 'vunnet', 'tapt']

function StatusBadge({ status }: { status: LeadStatus }) {
  const { t } = useLocale()
  const s = STATUS[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {t(s.labelKey)}
    </span>
  )
}

function fmtDate(iso: string, dateLocale: string) {
  return new Date(iso).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })
}

function sourceLabelKey(src: string): TranslationKey {
  return src === 'oppstartsskjema' ? 'leads.source.form' : 'leads.source.manual'
}

// ── New lead modal ─────────────────────────────────────────────────────────────

function NewLeadModal({
  onClose,
  onCreated,
}: {
  onClose:   () => void
  onCreated: (lead: Lead) => void
}) {
  const { t } = useLocale()
  const [name,    setName]    = useState('')
  const [email,   setEmail]   = useState('')
  const [phone,   setPhone]   = useState('')
  const [notes,   setNotes]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError(t('leads.modal.nameRequired')); return }
    setSaving(true); setError('')

    const res = await fetch('/api/leads', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, email, phone, notes }),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) { setError(data.error ?? t('leads.modal.saveFailed')); return }
    onCreated(data.lead)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{t('leads.new')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('leads.modal.nameLabel')}</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Ola Nordmann" autoFocus
              className="w-full h-10 px-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('settings.profile.email')}</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder={t('leads.modal.emailPlaceholder')}
                className="w-full h-10 px-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('leads.col.phone')}</label>
              <input
                type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder={t('leads.modal.phonePlaceholder')}
                className="w-full h-10 px-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('leads.modal.notesLabel')}</label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              rows={3} placeholder={t('leads.modal.notesPlaceholder')}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 h-10 rounded-xl bg-[#2d8653] hover:bg-[#2d8653] text-white text-sm font-semibold disabled:opacity-50 transition-colors">
              {saving ? t('common.saving') : t('leads.modal.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Lead detail slide-over ─────────────────────────────────────────────────────

function LeadPanel({
  lead,
  onClose,
  onUpdated,
}: {
  lead:      Lead
  onClose:   () => void
  onUpdated: (id: string, patch: Partial<Lead>) => void
}) {
  const { t, locale } = useLocale()
  const dateLocale = locale === 'en' ? 'en-US' : 'nb-NO'
  const [status,  setStatus]  = useState<LeadStatus>(lead.status)
  const [notes,   setNotes]   = useState(lead.notes ?? '')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [saved,   setSaved]   = useState(false)

  async function handleSave() {
    setSaving(true); setError(''); setSaved(false)
    const res = await fetch(`/api/leads/${lead.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status, notes: notes.trim() || null }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? t('leads.panel.saveFailed'))
      return
    }
    onUpdated(lead.id, { status, notes: notes.trim() || null })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full z-50 w-[380px] bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{lead.full_name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{t(sourceLabelKey(lead.source))}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Status selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('leads.col.status')}</label>
            <div className="flex flex-wrap gap-2">
              {ALL_STATUSES.map(s => {
                const cfg = STATUS[s]
                const active = status === s
                return (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      active
                        ? `${cfg.bg} ${cfg.text} ring-2 ring-offset-1 ring-current`
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${active ? cfg.dot : 'bg-gray-400'}`} />
                    {t(cfg.labelKey)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Contact info */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('leads.panel.contactInfo')}</label>
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">{t('leads.col.email')}</span>
                <span className="text-sm text-gray-900 font-medium">{lead.email ?? '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">{t('leads.col.phone')}</span>
                <span className="text-sm text-gray-900 font-medium">{lead.phone ?? '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">{t('leads.col.createdAt')}</span>
                <span className="text-sm text-gray-900 font-medium">{fmtDate(lead.created_at, dateLocale)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">{t('leads.panel.source')}</span>
                <span className="text-sm text-gray-900 font-medium">{t(sourceLabelKey(lead.source))}</span>
              </div>
            </div>
          </div>

          {/* Form answers (if from oppstartsskjema) */}
          {lead.form_answers && Object.keys(lead.form_answers).length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('leads.panel.formAnswers')}</label>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                {Object.entries(lead.form_answers).map(([k, v]) => (
                  <div key={k}>
                    <p className="text-xs text-gray-500">{k}</p>
                    <p className="text-sm text-gray-900">{String(v)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('leads.modal.notesLabel')}</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder={t('leads.panel.notesPlaceholder')}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`w-full h-10 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
              saved
                ? 'bg-[#1a5c3a] text-white'
                : 'text-white disabled:opacity-50 [background:linear-gradient(to_right,#1a5c3a,#6ecfb0)] hover:[background:#1a5c3a]'
            }`}
          >
            {saved ? <><Check className="w-4 h-4" />{t('leads.panel.saved')}</> : saving ? t('common.saving') : t('leads.panel.saveChanges')}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Public link banner ─────────────────────────────────────────────────────────

function PublicLinkBanner({ coachId }: { coachId: string }) {
  const { t } = useLocale()
  const [copied, setCopied] = useState(false)
  const url = typeof window !== 'undefined'
    ? `${window.location.origin}/start/${coachId}`
    : `/start/${coachId}`

  function copy() {
    navigator.clipboard.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-3 bg-[#ebf5ef] border border-[#cdeee3] rounded-xl px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-[#1a5c3a] mb-0.5">{t('leads.publicLinkLabel')}</p>
        <p className="text-xs text-[#2d8653] truncate font-mono">/start/{coachId}</p>
      </div>
      <button
        onClick={copy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2d8653] hover:bg-[#2d8653] text-white text-xs font-semibold shrink-0 transition-colors"
      >
        {copied ? <><Check className="w-3.5 h-3.5" />{t('common.copied')}</> : <><Copy className="w-3.5 h-3.5" />{t('common.copy')}</>}
      </button>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

const TABS: Array<{ key: FilterStatus; labelKey: TranslationKey }> = [
  { key: 'all',          labelKey: 'leads.tabs.all'         },
  { key: 'ny',           labelKey: 'leads.status.new'       },
  { key: 'kontaktet',    labelKey: 'leads.status.contacted' },
  { key: 'kvalifisert',  labelKey: 'leads.status.qualified' },
  { key: 'vunnet',       labelKey: 'leads.status.won'       },
  { key: 'tapt',         labelKey: 'leads.status.lost'      },
]

export function LeadsView({
  initialLeads,
  coachId,
}: {
  initialLeads: Lead[]
  coachId:      string
}) {
  const { t, locale } = useLocale()
  const dateLocale = locale === 'en' ? 'en-US' : 'nb-NO'
  const [leads,        setLeads]        = useState(initialLeads)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [showNew,      setShowNew]      = useState(false)

  const counts: Record<FilterStatus, number> = {
    all:         leads.length,
    ny:          leads.filter(l => l.status === 'ny').length,
    kontaktet:   leads.filter(l => l.status === 'kontaktet').length,
    kvalifisert: leads.filter(l => l.status === 'kvalifisert').length,
    vunnet:      leads.filter(l => l.status === 'vunnet').length,
    tapt:        leads.filter(l => l.status === 'tapt').length,
  }

  const visible = filterStatus === 'all'
    ? leads
    : leads.filter(l => l.status === filterStatus)

  function handleUpdated(id: string, patch: Partial<Lead>) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
    setSelectedLead(s => s?.id === id ? { ...s, ...patch } : s)
  }

  function handleCreated(lead: Lead) {
    setLeads(prev => [lead, ...prev])
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a5c3a]">{t('leads.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {leads.length} leads{counts.ny > 0 ? `, ${counts.ny} ${t('leads.newCountSuffix')}` : ''}
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 h-9 px-4 text-white text-sm font-semibold rounded-xl transition-all [background:linear-gradient(to_right,#1a5c3a,#6ecfb0)] hover:[background:#1a5c3a]"
        >
          <Plus className="w-4 h-4" />
          {t('leads.new')}
        </button>
      </div>

      {/* Public link */}
      <PublicLinkBanner coachId={coachId} />

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === tab.key
                ? 'bg-white text-[#1a5c3a] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t(tab.labelKey)}
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
              filterStatus === tab.key ? 'bg-[#cdeee3] text-[#1a5c3a]' : 'bg-gray-200 text-gray-500'
            }`}>
              {counts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <div className="border border-gray-100 rounded-2xl py-16 text-center bg-white">
          <UserPlus className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {filterStatus === 'all'
              ? t('leads.emptyAll')
              : `${t('leads.emptyFilteredPrefix')} "${t(STATUS[filterStatus].labelKey)}"`}
          </p>
          {filterStatus === 'all' && (
            <p className="text-sm text-gray-400 mt-1">
              {t('leads.emptyHint')}
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">{t('leads.col.name')}</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">{t('leads.col.status')}</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">{t('leads.col.email')}</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">{t('leads.col.phone')}</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">{t('leads.col.createdAt')}</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visible.map(lead => (
                <tr
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors group"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#cdeee3] flex items-center justify-center text-xs font-bold text-[#1a5c3a] shrink-0">
                        {lead.full_name.slice(0, 1).toUpperCase()}
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{lead.full_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={lead.status} />
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">{lead.email ?? '—'}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">{lead.phone ?? '—'}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-500">{fmtDate(lead.created_at, dateLocale)}</td>
                  <td className="px-5 py-3.5">
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail panel */}
      {selectedLead && (
        <LeadPanel
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdated={handleUpdated}
        />
      )}

      {/* New lead modal */}
      {showNew && (
        <NewLeadModal
          onClose={() => setShowNew(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}
