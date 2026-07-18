'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, MoreVertical, CheckCircle2, XCircle, ChevronDown } from 'lucide-react'
import type { ClientStatus } from '@coaching/types'

export interface ClientRow {
  id: string
  profileId: string
  name: string
  joinedAt: string
  status: ClientStatus
  hasMealPlan: boolean
  hasTrainingPlan: boolean
  checkinCount: number
  lastActivity: string | null
  coachName: string | null
}

// ── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ClientStatus, { label: string; pill: string; dot: string }> = {
  active:     { label: 'Aktiv',             pill: 'bg-[#ebf5ef] text-[#1a5c3a]', dot: 'bg-[#2d8653]' },
  inactive:   { label: 'Inaktiv',           pill: 'bg-gray-100 text-gray-500',    dot: 'bg-gray-400' },
  new:        { label: 'Ny klient',         pill: 'bg-[#ebf5ef] text-[#1a5c3a]', dot: 'bg-[#2d8653]' },
  onboarding: { label: 'Venter onboarding', pill: 'bg-yellow-50 text-yellow-700', dot: 'bg-yellow-500' },
  course:     { label: 'På kurs',           pill: 'bg-[#ebf5ef] text-[#1a5c3a]', dot: 'bg-[#2d8653]' },
  followup:   { label: 'Oppfølging',        pill: 'bg-orange-50 text-orange-700', dot: 'bg-orange-400' },
  app_access: { label: 'App tilgang',       pill: 'bg-blue-50 text-blue-700',     dot: 'bg-blue-500' },
}

// ── Filter tabs ──────────────────────────────────────────────────────────────

const FILTERS = [
  { key: 'alle',       label: 'Alle',              match: (_: ClientRow) => true },
  { key: 'aktive',     label: 'Aktive',            match: (c: ClientRow) => c.status === 'active' },
  { key: 'inaktive',   label: 'Inaktive',          match: (c: ClientRow) => c.status === 'inactive' },
  { key: 'app',        label: 'App tilgang',       match: (c: ClientRow) => c.status === 'app_access' },
  { key: 'nye',        label: 'Nye',               match: (c: ClientRow) => c.status === 'new' },
  { key: 'onboarding', label: 'Venter onboarding', match: (c: ClientRow) => c.status === 'onboarding' },
  { key: 'kurs',       label: 'På kurs',           match: (c: ClientRow) => c.status === 'course' },
  { key: 'oppfolging', label: 'Oppfølging',        match: (c: ClientRow) => c.status === 'followup' },
] as const

type FilterKey = (typeof FILTERS)[number]['key']

// ── Helpers ──────────────────────────────────────────────────────────────────

const GRADIENTS = [
  'from-[#6ecfb0] to-[#2d8653]', 'from-violet-400 to-violet-600',
  'from-green-400 to-green-600', 'from-orange-400 to-orange-600',
  'from-pink-400 to-pink-600', 'from-teal-400 to-teal-600',
  'from-rose-400 to-rose-600', 'from-amber-400 to-amber-600',
]

function gradient(name: string) {
  return GRADIENTS[(name.charCodeAt(0) ?? 0) % GRADIENTS.length]
}

function initials(name: string) {
  const p = name.trim().split(/\s+/)
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}

function relativeDate(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (d === 0) return 'I dag'
  if (d === 1) return 'I går'
  if (d < 7) return `${d}d siden`
  if (d < 30) return `${Math.floor(d / 7)}u siden`
  if (d < 365) return `${Math.floor(d / 30)}mnd siden`
  return `${Math.floor(d / 365)}år siden`
}

// ── Main component ────────────────────────────────────────────────────────────

export function ClientList({ clients: initial }: { clients: ClientRow[]; coachId: string }) {
  const router = useRouter()
  const [clients, setClients] = useState(initial)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterKey>('alle')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)

  const counts = useMemo(() =>
    Object.fromEntries(FILTERS.map(f => [f.key, clients.filter(f.match).length])),
    [clients]
  )

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase()
    const tabMatch = FILTERS.find(f => f.key === filter)!.match
    return clients
      .filter(c => !q || c.name.toLowerCase().includes(q))
      .filter(tabMatch)
  }, [clients, search, filter])

  async function updateStatus(profileId: string, newStatus: ClientStatus) {
    const old = clients.find(c => c.profileId === profileId)?.status
    setClients(cs => cs.map(c => c.profileId === profileId ? { ...c, status: newStatus } : c))
    setOpenMenu(null)

    const res = await fetch(`/api/clients/${profileId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })

    if (!res.ok) {
      setClients(cs => cs.map(c => c.profileId === profileId ? { ...c, status: old! } : c))
      const err = await res.json().catch(() => ({}))
      setStatusError(err.error ?? 'Kunne ikke oppdatere status')
      setTimeout(() => setStatusError(null), 4000)
    }
  }

  return (
    <div className="space-y-4">
      {/* Search + coach dropdown */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Søk etter klient..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 h-10 rounded-xl border border-gray-200 bg-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2d8653] focus:border-transparent"
          />
        </div>
        <div className="relative">
          <select
            className="appearance-none h-10 pl-3 pr-8 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2d8653] cursor-pointer"
            defaultValue="all"
          >
            <option value="all">Alle coacher</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Error toast */}
      {statusError && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-2.5 rounded-xl">
          {statusError}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto scrollbar-hide">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`relative flex-shrink-0 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
              filter === f.key
                ? 'text-[#2d8653] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#2d8653]'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {f.label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
              filter === f.key ? 'bg-[#cdeee3] text-[#1a5c3a]' : 'bg-gray-100 text-gray-500'
            }`}>
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Column headers */}
      {displayed.length > 0 && (
        <div className="grid grid-cols-[1fr_150px_90px_90px_100px_36px] gap-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          <span>Klient</span>
          <span>Status</span>
          <span className="text-center">Matplan</span>
          <span className="text-center">Trening</span>
          <span className="text-center">Aktivitet</span>
          <span />
        </div>
      )}

      {/* Rows */}
      {displayed.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Search className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p className="font-medium text-gray-500">Ingen klienter funnet</p>
          <p className="text-sm mt-1">Prøv et annet søkeord eller filter</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {displayed.map(client => {
            const sc = STATUS_CONFIG[client.status]
            const isMenuOpen = openMenu === client.profileId
            return (
              <div key={client.id} className="relative">
                {/* Overlay to close menu */}
                {isMenuOpen && (
                  <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                )}

                <div
                  onClick={() => router.push(`/clients/${client.profileId}`)}
                  className="bg-white rounded-xl border border-gray-100 hover:border-[#cdeee3] hover:shadow-sm transition-all p-3 grid grid-cols-[1fr_150px_90px_90px_100px_36px] gap-3 items-center cursor-pointer group"
                >
                  {/* Avatar + name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradient(client.name)} flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}>
                      {initials(client.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate text-sm group-hover:text-[#1a5c3a] transition-colors">
                        {client.name}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {client.coachName
                          ? `Coach: ${client.coachName}`
                          : `Klient siden ${new Date(client.joinedAt).toLocaleDateString('nb-NO', { month: 'short', year: 'numeric' })}`
                        }
                      </p>
                    </div>
                  </div>

                  {/* Status badge */}
                  <div>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${sc.pill}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                      {sc.label}
                    </span>
                  </div>

                  {/* Matplan */}
                  <div className="flex justify-center">
                    {client.hasMealPlan
                      ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                      : <XCircle className="w-5 h-5 text-gray-200" />
                    }
                  </div>

                  {/* Treningsplan */}
                  <div className="flex justify-center">
                    {client.hasTrainingPlan
                      ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                      : <XCircle className="w-5 h-5 text-gray-200" />
                    }
                  </div>

                  {/* Siste aktivitet */}
                  <div className="text-center">
                    {client.lastActivity ? (
                      <span className="text-xs text-gray-600">{relativeDate(client.lastActivity)}</span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </div>

                  {/* 3-dot menu */}
                  <div
                    className="relative z-20 flex justify-center"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setOpenMenu(isMenuOpen ? null : client.profileId)}
                      className="p-1 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100"
                      title="Endre status"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {isMenuOpen && (
                      <div className="absolute right-0 top-8 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-30 min-w-[180px]">
                        <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                          Sett status
                        </p>
                        {(Object.entries(STATUS_CONFIG) as [ClientStatus, typeof STATUS_CONFIG[ClientStatus]][]).map(([s, cfg]) => (
                          <button
                            key={s}
                            onClick={() => updateStatus(client.profileId, s)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-gray-50 ${
                              client.status === s ? 'font-semibold' : 'text-gray-700'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                            {cfg.label}
                            {client.status === s && (
                              <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-gray-400" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
