'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  UtensilsCrossed, MoreVertical, UserPlus, Pencil, Copy, Trash2, X, CheckCircle2,
} from 'lucide-react'

type Tab = 'maler' | 'alle'

export interface MealPlanRow {
  id: string
  title: string
  client_id: string | null
  is_template: boolean
  client_name: string | null
  calories_target: number | null
  protein_g: number | null
  meal_count: number
  created_at: string
}

interface Props {
  plans: MealPlanRow[]
  clients: { id: string; name: string }[]
}

export function MealPlanList({ plans, clients }: Props) {
  const router = useRouter()
  const [tab, setTab]                   = useState<Tab>('maler')
  const [openMenu, setOpenMenu]         = useState<string | null>(null)
  const [deleting, setDeleting]         = useState<string | null>(null)
  const [duplicating, setDuplicating]   = useState<string | null>(null)
  const [assigningPlanId, setAssigning] = useState<string | null>(null)
  const [selectedClient, setSelected]   = useState('')
  const [assigning, setAssigningBusy]   = useState(false)
  const [toast, setToast]               = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const maler    = useMemo(() => plans.filter(p => p.is_template || !p.client_id), [plans])
  const alle     = useMemo(() => plans.filter(p => !p.is_template && !!p.client_id), [plans])
  const displayed = tab === 'maler' ? maler : alle

  async function handleDelete(plan: MealPlanRow) {
    if (!confirm(`Slett "${plan.title}"? Dette kan ikke angres.`)) return
    setDeleting(plan.id)
    setOpenMenu(null)
    const res = await fetch(`/api/meal-plans/${plan.id}`, { method: 'DELETE' })
    setDeleting(null)
    if (res.ok) { showToast('Matplan slettet'); router.refresh() }
    else        { showToast('Kunne ikke slette planen', 'err') }
  }

  async function handleDuplicate(plan: MealPlanRow) {
    setDuplicating(plan.id)
    setOpenMenu(null)
    const res = await fetch(`/api/meal-plans/${plan.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'duplicate' }),
    })
    setDuplicating(null)
    if (res.ok) {
      const { newPlanId } = await res.json()
      showToast('Plan duplisert')
      router.push(`/meal-plans/${newPlanId}`)
    } else {
      showToast('Kunne ikke duplisere', 'err')
    }
  }

  async function handleAssign(planId: string) {
    if (!selectedClient) return
    setAssigningBusy(true)
    const res = await fetch(`/api/meal-plans/${planId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: selectedClient }),
    })
    const data = await res.json()
    setAssigningBusy(false)
    setAssigning(null)
    setSelected('')
    if (data.newPlanId) { router.push(`/meal-plans/${data.newPlanId}`) }
    else                { showToast('Kunne ikke bruke mal', 'err') }
  }

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
          toast.type === 'ok' ? 'bg-[#1a5c3a] text-white' : 'bg-red-600 text-white'
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

      {/* List */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-100 py-20">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <UtensilsCrossed className="w-6 h-6 text-gray-300" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">
            {tab === 'maler' ? 'Ingen maler ennå' : 'Ingen matplaner'}
          </h3>
          <p className="text-sm text-gray-400">
            {tab === 'maler'
              ? 'Opprett en mal for å gjenbruke den for flere klienter'
              : 'Lag din første matplan'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map(plan => {
            const isTemplate = !plan.client_id
            const isMenuOpen = openMenu === plan.id
            const isAssigningThis = assigningPlanId === plan.id

            return (
              <div key={plan.id} className="relative">
                {isMenuOpen && (
                  <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                )}

                <div className="bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all p-4 flex items-start gap-4">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl bg-[#ebf5ef] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <UtensilsCrossed className="w-5 h-5 text-[#1a5c3a]" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{plan.title}</span>
                      {isTemplate && (
                        <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#cdeee3] text-[#1a5c3a]">
                          MAL
                        </span>
                      )}
                      {plan.client_name && (
                        <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#ebf5ef] text-[#2d8653]">
                          {plan.client_name}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                      {plan.calories_target && (
                        <span>{plan.calories_target} kcal</span>
                      )}
                      {plan.protein_g && (
                        <span>{plan.protein_g}g protein</span>
                      )}
                      <span>{plan.meal_count} måltider</span>
                      <span>·</span>
                      <span>{new Date(plan.created_at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </p>

                    {/* Assign inline form */}
                    {isAssigningThis && (
                      <div className="flex items-center gap-2 mt-3" onClick={e => e.stopPropagation()}>
                        <select
                          value={selectedClient}
                          onChange={e => setSelected(e.target.value)}
                          className="h-8 text-xs border border-gray-200 rounded-lg px-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
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
                          className="h-8 px-3 rounded-lg bg-[#1a5c3a] text-white text-xs font-semibold hover:bg-[#2d8653] disabled:opacity-50 transition-colors"
                        >
                          {assigning ? 'Bruker...' : 'Bekreft'}
                        </button>
                        <button
                          onClick={() => { setAssigning(null); setSelected('') }}
                          className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {!isAssigningThis && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isTemplate && (
                        <button
                          onClick={() => { setAssigning(plan.id); setSelected('') }}
                          className="h-8 px-3 rounded-lg border border-[#cdeee3] bg-[#ebf5ef] text-[#1a5c3a] text-xs font-semibold hover:bg-[#cdeee3] transition-colors flex items-center gap-1.5"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          Bruk mal
                        </button>
                      )}

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
                              href={`/meal-plans/${plan.id}`}
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
