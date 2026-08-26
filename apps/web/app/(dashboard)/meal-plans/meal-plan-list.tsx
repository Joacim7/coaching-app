'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  UtensilsCrossed, MoreVertical, UserPlus, Pencil, Copy, Trash2, X, CheckCircle2, Search,
} from 'lucide-react'
import { useLocale } from '@/components/locale-provider'
import type { TranslationKey } from '@/lib/i18n/translations'

type Tab = 'maler' | 'alle'

const TABS: Array<{ key: Tab; labelKey: TranslationKey }> = [
  { key: 'maler', labelKey: 'mealPlans.tabMyTemplates' },
  { key: 'alle',  labelKey: 'mealPlans.tabAllPlans' },
]

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
  const { t, locale } = useLocale()
  const dateLocale = locale === 'en' ? 'en-US' : 'nb-NO'
  const [tab, setTab]                   = useState<Tab>('maler')
  const [openMenu, setOpenMenu]         = useState<string | null>(null)
  const [deleting, setDeleting]         = useState<string | null>(null)
  const [duplicating, setDuplicating]   = useState<string | null>(null)
  const [assigningPlanId, setAssigning] = useState<string | null>(null)
  const [selectedClient, setSelected]   = useState('')
  const [clientQuery, setClientQuery]   = useState('')
  const [assigning, setAssigningBusy]   = useState(false)
  const [toast, setToast]               = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const maler    = useMemo(() => plans.filter(p => p.is_template || !p.client_id), [plans])
  const alle     = useMemo(() => plans.filter(p => !p.is_template && !!p.client_id), [plans])
  const displayed = tab === 'maler' ? maler : alle

  const selectedClientObj = clients.find(c => c.id === selectedClient)
  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase()
    if (!q) return clients
    return clients.filter(c => c.name.toLowerCase().includes(q))
  }, [clients, clientQuery])

  async function handleDelete(plan: MealPlanRow) {
    if (!confirm(t('mealPlans.deleteConfirm', { title: plan.title }))) return
    setDeleting(plan.id)
    setOpenMenu(null)
    const res = await fetch(`/api/meal-plans/${plan.id}`, { method: 'DELETE' })
    setDeleting(null)
    if (res.ok) { showToast(t('mealPlans.deleted')); router.refresh() }
    else        { showToast(t('mealPlans.deleteFailed'), 'err') }
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
      showToast(t('mealPlans.duplicated'))
      router.push(`/meal-plans/${newPlanId}`)
    } else {
      showToast(t('mealPlans.duplicateFailed'), 'err')
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
    setClientQuery('')
    if (data.newPlanId) { router.push(`/meal-plans/${data.newPlanId}`) }
    else                { showToast(t('mealPlans.useTemplateFailed'), 'err') }
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
        {TABS.map(tabCfg => {
          const count = tabCfg.key === 'maler' ? maler.length : alle.length
          return (
            <button
              key={tabCfg.key}
              onClick={() => setTab(tabCfg.key)}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                tab === tabCfg.key
                  ? 'text-[#2d8653] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#2d8653]'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {t(tabCfg.labelKey)}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                tab === tabCfg.key ? 'bg-[#cdeee3] text-[#1a5c3a]' : 'bg-gray-100 text-gray-500'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* List */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-100 py-20">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <UtensilsCrossed className="w-6 h-6 text-gray-300" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">
            {tab === 'maler' ? t('mealPlans.noTemplatesYet') : t('mealPlans.noMealPlans')}
          </h3>
          <p className="text-sm text-gray-400">
            {tab === 'maler'
              ? t('mealPlans.emptySub')
              : t('mealPlans.createFirst')}
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
                          {t('mealPlans.templateBadge')}
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
                        <span>{plan.protein_g}g {t('mealPlans.proteinSuffix')}</span>
                      )}
                      <span>{plan.meal_count} {t('mealPlans.mealCountSuffix')}</span>
                      <span>·</span>
                      <span>{new Date(plan.created_at).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </p>

                    {/* Assign inline form */}
                    {isAssigningThis && (
                      <div className="flex items-start gap-2 mt-3" onClick={e => e.stopPropagation()}>
                        <div className="relative">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="text"
                              autoFocus
                              value={selectedClientObj ? selectedClientObj.name : clientQuery}
                              onChange={e => { setClientQuery(e.target.value); setSelected('') }}
                              onFocus={() => setSelected('')}
                              placeholder={t('mealPlans.searchClient')}
                              className="h-8 w-44 text-xs border border-gray-200 rounded-lg pl-7 pr-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
                            />
                          </div>
                          {!selectedClient && (
                            <div className="absolute z-20 mt-1 w-44 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                              {filteredClients.length === 0 ? (
                                <p className="px-3 py-2 text-xs text-gray-400">{t('mealPlans.noMatches')}</p>
                              ) : (
                                filteredClients.map(c => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => { setSelected(c.id); setClientQuery(c.name) }}
                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#ebf5ef] transition-colors"
                                  >
                                    {c.name}
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleAssign(plan.id)}
                          disabled={!selectedClient || assigning}
                          className="h-8 px-3 rounded-lg bg-[#1a5c3a] text-white text-xs font-semibold hover:bg-[#2d8653] disabled:opacity-50 transition-colors"
                        >
                          {assigning ? t('mealPlans.applying') : t('mealPlans.confirm')}
                        </button>
                        <button
                          onClick={() => { setAssigning(null); setSelected(''); setClientQuery('') }}
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
                          onClick={() => { setAssigning(plan.id); setSelected(''); setClientQuery('') }}
                          className="h-8 px-3 rounded-lg border border-[#cdeee3] bg-[#ebf5ef] text-[#1a5c3a] text-xs font-semibold hover:bg-[#cdeee3] transition-colors flex items-center gap-1.5"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          {t('mealPlans.useTemplate')}
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
                              {t('mealPlans.edit')}
                            </Link>
                            <button
                              onClick={() => handleDuplicate(plan)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5 text-gray-400" />
                              {duplicating === plan.id ? t('mealPlans.duplicating') : t('mealPlans.duplicate')}
                            </button>
                            <div className="mx-2 my-1 border-t border-gray-100" />
                            <button
                              onClick={() => handleDelete(plan)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              {deleting === plan.id ? t('mealPlans.deleting') : t('mealPlans.delete')}
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
