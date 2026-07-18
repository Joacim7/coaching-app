'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CreditCard, TrendingUp, Calendar, Clock, CheckCircle2 } from 'lucide-react'

interface Contract {
  id: string
  monthly_price: number
  duration_months: number
  start_date: string
}

interface Props {
  clientId: string
  coachId: string
  initialContract: Contract | null
}

function fmt(n: number) {
  return 'kr ' + Math.round(n).toLocaleString('nb-NO')
}

export function FinanceView({ clientId, coachId, initialContract }: Props) {
  const [price,     setPrice]     = useState(initialContract?.monthly_price?.toString()   ?? '')
  const [months,    setMonths]    = useState(initialContract?.duration_months?.toString() ?? '')
  const [startDate, setStartDate] = useState(initialContract?.start_date ?? '')
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [savedContract, setSavedContract] = useState<Contract | null>(initialContract)

  async function handleSave() {
    const mp = parseFloat(price)
    const dm = parseInt(months)
    if (!mp || !dm || !startDate) return

    setSaving(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('client_contracts')
      .upsert(
        { client_id: clientId, coach_id: coachId, monthly_price: mp, duration_months: dm, start_date: startDate, updated_at: new Date().toISOString() },
        { onConflict: 'coach_id,client_id' },
      )
      .select()
      .single()

    if (data) {
      setSavedContract(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
    setSaving(false)
  }

  // ── Derived values (from live form state) ──────────────────────────────
  const monthlyPrice    = parseFloat(price)  || 0
  const durationMonths  = parseInt(months)   || 0
  const totalValue      = monthlyPrice * durationMonths

  let endDate: Date | null = null
  let endDateStr           = '—'
  let remainingMonths      = 0
  let isActive             = false

  if (startDate && durationMonths > 0) {
    const start = new Date(startDate)
    endDate     = new Date(start)
    endDate.setMonth(endDate.getMonth() + durationMonths)

    const todaySOD = new Date()
    todaySOD.setHours(0, 0, 0, 0)
    isActive = endDate > todaySOD

    if (isActive) {
      const todayBOM = new Date(todaySOD.getFullYear(), todaySOD.getMonth(), 1)
      remainingMonths = Math.max(
        0,
        (endDate.getFullYear() - todayBOM.getFullYear()) * 12 +
          (endDate.getMonth() - todayBOM.getMonth()),
      )
    }

    endDateStr = endDate.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const remainingValue = remainingMonths * monthlyPrice

  // ── Remaining months list ──────────────────────────────────────────────
  const monthRows: { label: string; isCurrent: boolean }[] = []
  if (startDate && durationMonths > 0 && endDate) {
    const today   = new Date()
    const todayBOM = new Date(today.getFullYear(), today.getMonth(), 1)
    const startBOM = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth(), 1)
    const fromBOM  = startBOM > todayBOM ? startBOM : todayBOM
    const endBOM   = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
    const cursor   = new Date(fromBOM)

    while (cursor < endBOM) {
      const isCurrent =
        cursor.getFullYear() === today.getFullYear() &&
        cursor.getMonth()    === today.getMonth()
      monthRows.push({
        label: cursor.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' }),
        isCurrent,
      })
      cursor.setMonth(cursor.getMonth() + 1)
    }
  }

  const hasData = monthlyPrice > 0 && durationMonths > 0 && startDate

  const inputCls =
    'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8653]/25 focus:border-[#2d8653] transition-colors'

  return (
    <div className="space-y-6">
      {/* ── 1. Kontraktinformasjon ─────────────────────────────── */}
      <section className="border border-gray-100 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 bg-gray-50/60">
          <CreditCard className="w-4 h-4 text-[#2d8653]" />
          <h2 className="text-sm font-semibold text-gray-900">Kontraktinformasjon</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                Månedlig pris (kr)
              </label>
              <input
                type="number"
                min="0"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="5000"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                Kontraktslengde (måneder)
              </label>
              <input
                type="number"
                min="1"
                value={months}
                onChange={e => setMonths(e.target.value)}
                placeholder="12"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              Startdato
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !price || !months || !startDate}
            className="px-5 py-2.5 bg-[#2d8653] text-white text-sm font-semibold rounded-xl hover:bg-[#1a5c3a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Lagrer…' : saved ? '✓ Lagret' : 'Lagre endringer'}
          </button>
        </div>
      </section>

      {/* ── 2. Summary cards ──────────────────────────────────── */}
      {hasData && (
        <div className="grid grid-cols-2 gap-3">
          {/* Total kontraktsverdi */}
          <div className="bg-[#ebf5ef] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 rounded-lg bg-[#cdeee3] flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-[#2d8653]" />
              </span>
              <span className="text-[10px] font-bold text-[#6ecfb0] uppercase tracking-wider">
                Total kontraktsverdi
              </span>
            </div>
            <p className="text-2xl font-bold text-[#1a5c3a]">{fmt(totalValue)}</p>
            <p className="text-xs text-[#6ecfb0] mt-0.5">{fmt(monthlyPrice)} × {durationMonths} mnd</p>
          </div>

          {/* Gjenværende verdi */}
          <div className="bg-violet-50 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-violet-600" />
              </span>
              <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">
                Gjenværende verdi
              </span>
            </div>
            <p className="text-2xl font-bold text-violet-900">{fmt(remainingValue)}</p>
            <p className="text-xs text-violet-400 mt-0.5">{remainingMonths} måneder igjen</p>
          </div>

          {/* Kontraktslutt */}
          <div className="bg-amber-50 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
              </span>
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                Kontraktslutt
              </span>
            </div>
            <p className="text-base font-bold text-amber-900 leading-tight">{endDateStr}</p>
          </div>

          {/* Status */}
          <div className={`${isActive ? 'bg-[#ebf5ef]' : 'bg-red-50'} rounded-2xl p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${isActive ? 'bg-[#cdeee3]' : 'bg-red-100'}`}>
                <CheckCircle2 className={`w-3.5 h-3.5 ${isActive ? 'text-[#2d8653]' : 'text-red-500'}`} />
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-[#6ecfb0]' : 'text-red-300'}`}>
                Status
              </span>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${
              isActive
                ? 'bg-[#2d8653] text-white'
                : 'bg-red-500 text-white'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-white'}`} />
              {isActive ? 'Aktiv' : 'Utløpt'}
            </span>
          </div>
        </div>
      )}

      {/* ── 3. Månedlig oversikt ──────────────────────────────── */}
      {hasData && monthRows.length > 0 && (
        <section className="border border-gray-100 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/60">
            <h2 className="text-sm font-semibold text-gray-900">Månedlig oversikt</h2>
            <span className="text-xs text-gray-400">{monthRows.length} måneder igjen</span>
          </div>
          <div className="divide-y divide-gray-50">
            {monthRows.map((row, i) => (
              <div
                key={i}
                className={`flex items-center justify-between px-5 py-3 ${
                  row.isCurrent ? 'bg-[#f0faf5]' : 'bg-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {row.isCurrent && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2d8653]" />
                  )}
                  <span className={`text-sm ${row.isCurrent ? 'font-semibold text-[#1a5c3a]' : 'text-gray-600'}`}>
                    {row.label.charAt(0).toUpperCase() + row.label.slice(1)}
                  </span>
                  {row.isCurrent && (
                    <span className="text-[10px] font-bold text-[#2d8653] bg-[#cdeee3] px-1.5 py-0.5 rounded-full">
                      Nåværende
                    </span>
                  )}
                </div>
                <span className={`text-sm font-semibold ${row.isCurrent ? 'text-[#1a5c3a]' : 'text-gray-700'}`}>
                  {fmt(monthlyPrice)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
