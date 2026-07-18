'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Dumbbell, MoreVertical, UserPlus, Pencil, Copy, Trash2, X, CheckCircle2, Share2,
} from 'lucide-react'

type Tab = 'maler' | 'alle'

export interface PlanRow {
  id: string
  title: string
  description: string | null
  client_id: string | null
  client_name: string | null
  session_count: number
  created_at: string
  is_org_shared?: boolean
}

interface Props {
  plans: PlanRow[]
  clients: { id: string; name: string }[]
  sharedIds?: Set<string>
}

export function TrainingPlanList({ plans, clients, sharedIds = new Set() }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('maler')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [duplicating, setDuplicating] = useState<string | null>(null)
  const [assigningPlanId, setAssigningPlanId] = useState<string | null>(null)
  const [selectedClient, setSelectedClient] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const maler    = useMemo(() => plans.filter(p => !p.client_id), [plans])
  const alle     = useMemo(() => plans.filter(p => !!p.client_id), [plans])
  const displayed = tab === 'maler' ? maler : alle

  async function handleDelete(plan: PlanRow) {
    if (!confirm(`Slett "${plan.title}"? Dette kan ikke angres.`)) return
    setDeleting(plan.id)
    setOpenMenu(null)
    const res = await fetch(`/api/training-plans/${plan.id}`, { method: 'DELETE' })
    setDeleting(null)
    if (res.ok) {
      showToast('Treningsplan slettet')
      router.refresh()
    } else {
      showToast('Kunne ikke slette planen', 'err')
    }
  }

  async function handleDuplicate(plan: PlanRow) {
    setDuplicating(plan.id)
    setOpenMenu(null)
    const res = await fetch(`/api/training-plans/${plan.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'duplicate' }),
    })
    setDuplicating(null)
    if (res.ok) {
      const { newPlanId } = await res.json()
      showToast('Plan duplisert')
      router.push(`/training-plans/${newPlanId}`)
    } else {
      showToast('Kunne ikke duplisere', 'err')
    }
  }

  async function handleAssign(planId: string) {
    if (!selectedClient) return
    setAssigning(true)
    const res = await fetch(`/api/training-plans/${planId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: selectedClient }),
    })
    const data = await res.json()
    setAssigning(false)
    setAssigningPlanId(null)
    setSelectedClient('')
    if (data.newPlanId) {
      router.push(`/training-plans/${data.newPlanId}`)
    } else {
      showToast('Kunne ikke bruke mal', 'err')
    }
  }

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
          toast.type === 'ok' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {toast.msg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {([
          { key: 'maler', label: 'Mine maler', count: maler.length },
          { key: 'alle',  label: 'Alle planer', count: alle.length },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
              tab === t.key
                ? 'text-[#2d8653] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#2d8653]'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
              tab === t.key ? 'bg-[#cdeee3] text-[#1a5c3a]' : 'bg-gray-100 text-gray-500'
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Plan list */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-100 py-20">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <Dumbbell className="w-6 h-6 text-gray-300" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">
            {tab === 'maler' ? 'Ingen maler ennå' : 'Ingen treningsplaner'}
          </h3>
          <p className="text-sm text-gray-400">
            {tab === 'maler'
              ? 'Opprett en mal for å gjenbruke den for flere klienter'
              : 'Lag din første treningsplan'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map(plan => {
            const isTemplate = !plan.client_id
            const isMenuOpen = openMenu === plan.id
            const isAssigning = assigningPlanId === plan.id

            return (
              <div key={plan.id} className="relative">
                {isMenuOpen && (
                  <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                )}

                <div className="bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all p-4 flex items-start gap-4 group">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl bg-[#ebf5ef] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Dumbbell className="w-5 h-5 text-[#2d8653]" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{plan.title}</span>
                      {isTemplate && (
                        <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          MAL
                        </span>
                      )}
                      {plan.client_name && (
                        <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#ebf5ef] text-[#2d8653]">
                          {plan.client_name}
                        </span>
                      )}
                      {plan.is_org_shared && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">
                          <Share2 className="w-2.5 h-2.5" />
                          Delt
                        </span>
                      )}
                    </div>
                    {plan.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{plan.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {plan.session_count} treningsdager · {new Date(plan.created_at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>

                    {/* Assign inline form */}
                    {isAssigning && (
                      <div className="flex items-center gap-2 mt-3" onClick={e => e.stopPropagation()}>
                        <select
                          value={selectedClient}
                          onChange={e => setSelectedClient(e.target.value)}
                          className="h-8 text-xs border border-gray-200 rounded-lg px-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                          autoFocus
                        >
                          <option value="">Velg klient...</option>
                          {clients.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleAssign(plan.id)}
                          disabled={!selectedClient || assigning}
                          className="h-8 px-3 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          {assigning ? 'Bruker...' : 'Bekreft'}
                        </button>
                        <button
                          onClick={() => { setAssigningPlanId(null); setSelectedClient('') }}
                          className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {!isAssigning && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isTemplate && (
                        <button
                          onClick={() => { setAssigningPlanId(plan.id); setSelectedClient('') }}
                          className="h-8 px-3 rounded-lg border border-green-200 bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition-colors flex items-center gap-1.5"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          Bruk mal
                        </button>
                      )}

                      {/* 3-dot menu */}
                      <div className="relative z-20">
                        <button
                          onClick={e => { e.stopPropagation(); setOpenMenu(isMenuOpen ? null : plan.id) }}
                          disabled={deleting === plan.id || duplicating === plan.id}
                          className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {isMenuOpen && (
                          <div className="absolute right-0 top-9 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-30 min-w-[160px]">
                            <Link
                              href={`/training-plans/${plan.id}`}
                              className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                              onClick={() => setOpenMenu(null)}
                            >
                              <Pencil className="w-3.5 h-3.5 text-gray-400" />
                              Rediger
                            </Link>
                            <button
                              onClick={() => handleDuplicate(plan)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5 text-gray-400" />
                              {duplicating === plan.id ? 'Dupliserer...' : 'Dupliser'}
                            </button>
                            <div className="mx-2 my-1 border-t border-gray-100" />
                            <button
                              onClick={() => handleDelete(plan)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              {deleting === plan.id ? 'Sletter...' : 'Slett'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
