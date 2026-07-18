import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { DollarSign, FileText, Calendar, TrendingUp } from 'lucide-react'

interface ContractProfile {
  full_name: string | null
}

interface ContractRow {
  id: string
  monthly_price: number
  duration_months: number
  start_date: string
  profile: ContractProfile | ContractProfile[] | null
}

interface Contract {
  id: string
  clientName: string
  monthlyPrice: number
  durationMonths: number
  startDate: Date
  endDate: Date
  isActive: boolean
}

const FORECAST_MONTHS = 6

function fmt(n: number) {
  return 'kr ' + Math.round(n).toLocaleString('nb-NO')
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

export default async function FinancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data } = await supabase
    .from('client_contracts')
    .select('id, monthly_price, duration_months, start_date, profile:profiles!client_id(full_name)')
    .eq('coach_id', user!.id)
    .order('start_date', { ascending: false })

  const todaySOD = new Date()
  todaySOD.setHours(0, 0, 0, 0)

  const contracts: Contract[] = ((data ?? []) as ContractRow[]).map(row => {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile
    const start = new Date(row.start_date)
    const end   = addMonths(start, row.duration_months)
    return {
      id:             row.id,
      clientName:     profile?.full_name ?? 'Ukjent klient',
      monthlyPrice:   row.monthly_price,
      durationMonths: row.duration_months,
      startDate:      start,
      endDate:        end,
      isActive:       end > todaySOD,
    }
  })

  const activeContracts = contracts.filter(c => c.isActive)
  const activeCount     = activeContracts.length

  const totalMonthlyRevenue = activeContracts.reduce((s, c) => s + c.monthlyPrice, 0)
  const avgDuration         = activeCount > 0
    ? activeContracts.reduce((s, c) => s + c.durationMonths, 0) / activeCount
    : 0
  const avgMonthlyPrice     = activeCount > 0 ? totalMonthlyRevenue / activeCount : 0

  // Soonest-expiring first — the contracts that need attention show up at the top
  const sortedActive = [...activeContracts].sort((a, b) => a.endDate.getTime() - b.endDate.getTime())

  // Forward revenue forecast: for each of the next N months, sum monthly_price
  // for every active contract whose [startDate, endDate) window covers that month.
  const forecast = Array.from({ length: FORECAST_MONTHS }, (_, i) => {
    const monthStart = new Date(todaySOD.getFullYear(), todaySOD.getMonth() + i, 1)
    const monthEnd    = new Date(todaySOD.getFullYear(), todaySOD.getMonth() + i + 1, 1)
    const covering    = activeContracts.filter(c => c.startDate < monthEnd && c.endDate > monthStart)
    return {
      label:         monthStart.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' }),
      expected:      covering.reduce((s, c) => s + c.monthlyPrice, 0),
      contractCount: covering.length,
    }
  })

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1a5c3a]">Økonomi</h1>
        <p className="text-gray-500 mt-1">Oversikt over kontrakter og forventet inntekt</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-8 h-8 rounded-lg bg-[#cdeee3] flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-4 h-4 text-[#2d8653]" />
              </span>
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total månedlig inntekt</span>
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
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Antall aktive kontrakter</span>
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
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Snitt avtalelengde</span>
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
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Snitt månedspris</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{fmt(avgMonthlyPrice)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Active contracts table */}
      <section className="border border-gray-100 rounded-2xl overflow-hidden mb-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/60">
          <h2 className="text-sm font-semibold text-gray-900">Aktive kontrakter</h2>
          <span className="text-xs text-gray-400">{sortedActive.length} kontrakter</span>
        </div>

        {sortedActive.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">Ingen aktive kontrakter</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-5 py-3">Klient</th>
                  <th className="px-5 py-3">Månedspris</th>
                  <th className="px-5 py-3">Lengde</th>
                  <th className="px-5 py-3">Startdato</th>
                  <th className="px-5 py-3">Sluttdato</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedActive.map(c => (
                  <tr key={c.id}>
                    <td className="px-5 py-3 font-medium text-gray-900">{c.clientName}</td>
                    <td className="px-5 py-3 text-gray-700">{fmt(c.monthlyPrice)}</td>
                    <td className="px-5 py-3 text-gray-700">{c.durationMonths} mnd</td>
                    <td className="px-5 py-3 text-gray-500">{fmtDate(c.startDate)}</td>
                    <td className="px-5 py-3 text-gray-500">{fmtDate(c.endDate)}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-[#2d8653] text-white">
                        Aktiv
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
          <h2 className="text-sm font-semibold text-gray-900">Inntektsprognose</h2>
          <span className="text-xs text-gray-400">Neste {FORECAST_MONTHS} måneder</span>
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
                <span className="text-xs text-gray-400">{f.contractCount} kontrakter</span>
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
