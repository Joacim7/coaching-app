'use client'

import { Card, CardContent } from '@/components/ui/card'
import { DollarSign, FileText, Calendar, TrendingUp } from 'lucide-react'
import { useLocale } from '@/components/locale-provider'

export interface Contract {
  id: string
  clientName: string
  monthlyPrice: number
  durationMonths: number
  startDate: string
  endDate: string
  isActive: boolean
}

export interface ForecastMonth {
  label: string
  expected: number
  contractCount: number
}

function fmt(n: number) {
  return 'kr ' + Math.round(n).toLocaleString('nb-NO')
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function FinanceView({
  activeContracts,
  activeCount,
  totalMonthlyRevenue,
  avgDuration,
  avgMonthlyPrice,
  forecast,
  forecastMonths,
}: {
  activeContracts: Contract[]
  activeCount: number
  totalMonthlyRevenue: number
  avgDuration: number
  avgMonthlyPrice: number
  forecast: ForecastMonth[]
  forecastMonths: number
}) {
  const { t } = useLocale()

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1a5c3a]">{t('finance.title')}</h1>
        <p className="text-gray-500 mt-1">{t('finance.subtitle')}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-8 h-8 rounded-lg bg-[#cdeee3] flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-4 h-4 text-[#2d8653]" />
              </span>
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{t('finance.totalMonthlyRevenue')}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{fmt(totalMonthlyRevenue)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-8 h-8 rounded-lg bg-[#ebf5ef] flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-[#1a5c3a]" />
              </span>
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{t('finance.activeContractsCount')}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4 text-violet-600" />
              </span>
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{t('finance.avgDuration')}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{avgDuration.toFixed(1)} mnd</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-4 h-4 text-amber-600" />
              </span>
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{t('finance.avgMonthlyPrice')}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{fmt(avgMonthlyPrice)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Active contracts table */}
      <section className="border border-gray-100 rounded-2xl overflow-hidden mb-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/60">
          <h2 className="text-sm font-semibold text-gray-900">{t('finance.activeContracts')}</h2>
          <span className="text-xs text-gray-400">{activeContracts.length} {t('finance.contractsCount')}</span>
        </div>

        {activeContracts.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">{t('finance.noActiveContracts')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-5 py-3">{t('finance.table.client')}</th>
                  <th className="px-5 py-3">{t('finance.table.monthlyPrice')}</th>
                  <th className="px-5 py-3">{t('finance.table.duration')}</th>
                  <th className="px-5 py-3">{t('finance.table.startDate')}</th>
                  <th className="px-5 py-3">{t('finance.table.endDate')}</th>
                  <th className="px-5 py-3">{t('finance.table.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {activeContracts.map(c => (
                  <tr key={c.id}>
                    <td className="px-5 py-3 font-medium text-gray-900">{c.clientName}</td>
                    <td className="px-5 py-3 text-gray-700">{fmt(c.monthlyPrice)}</td>
                    <td className="px-5 py-3 text-gray-700">{c.durationMonths} mnd</td>
                    <td className="px-5 py-3 text-gray-500">{fmtDate(c.startDate)}</td>
                    <td className="px-5 py-3 text-gray-500">{fmtDate(c.endDate)}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-[#2d8653] text-white">
                        {t('finance.active')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Monthly revenue forecast */}
      <section className="border border-gray-100 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/60">
          <h2 className="text-sm font-semibold text-gray-900">{t('finance.forecastTitle')}</h2>
          <span className="text-xs text-gray-400">{t('finance.nextMonths', { n: forecastMonths })}</span>
        </div>
        <div className="divide-y divide-gray-50">
          {forecast.map((f, i) => (
            <div
              key={i}
              className={`flex items-center justify-between px-5 py-3.5 ${i === 0 ? 'bg-[#f0faf5]' : 'bg-white'}`}
            >
              <div className="flex items-center gap-2.5">
                {i === 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#2d8653]" />}
                <span className={`text-sm ${i === 0 ? 'font-semibold text-[#1a5c3a]' : 'text-gray-600'}`}>
                  {f.label.charAt(0).toUpperCase() + f.label.slice(1)}
                </span>
                <span className="text-xs text-gray-400">{f.contractCount} {t('finance.contractsCount')}</span>
              </div>
              <span className={`text-sm font-semibold ${i === 0 ? 'text-[#1a5c3a]' : 'text-gray-700'}`}>
                {fmt(f.expected)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
