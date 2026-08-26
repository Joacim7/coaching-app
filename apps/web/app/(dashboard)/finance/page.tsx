import { createClient } from '@/lib/supabase/server'
import { getTranslator, normalizeLocale } from '@/lib/i18n/translations'
import { FinanceView, type Contract, type ForecastMonth } from './finance-view'

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

const FORECAST_MONTHS = 6

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

export default async function FinancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data }, { data: coachProfile }] = await Promise.all([
    supabase
      .from('client_contracts')
      .select('id, monthly_price, duration_months, start_date, profile:profiles!client_id(full_name)')
      .eq('coach_id', user!.id)
      .order('start_date', { ascending: false }),
    supabase
      .from('profiles')
      .select('language')
      .eq('id', user!.id)
      .single(),
  ])

  const t = getTranslator(normalizeLocale(coachProfile?.language))
  const dateLocale = normalizeLocale(coachProfile?.language) === 'en' ? 'en-US' : 'nb-NO'

  const todaySOD = new Date()
  todaySOD.setHours(0, 0, 0, 0)

  const contracts: Contract[] = ((data ?? []) as ContractRow[]).map(row => {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile
    const start = new Date(row.start_date)
    const end   = addMonths(start, row.duration_months)
    return {
      id:             row.id,
      clientName:     profile?.full_name ?? t('dashboard.clientFallback'),
      monthlyPrice:   row.monthly_price,
      durationMonths: row.duration_months,
      startDate:      start.toISOString(),
      endDate:        end.toISOString(),
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
  const sortedActive = [...activeContracts].sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())

  // Forward revenue forecast: for each of the next N months, sum monthly_price
  // for every active contract whose [startDate, endDate) window covers that month.
  const activeContractsParsed = activeContracts.map(c => ({
    ...c,
    startDateObj: new Date(c.startDate),
    endDateObj:   new Date(c.endDate),
  }))

  const forecast: ForecastMonth[] = Array.from({ length: FORECAST_MONTHS }, (_, i) => {
    const monthStart = new Date(todaySOD.getFullYear(), todaySOD.getMonth() + i, 1)
    const monthEnd    = new Date(todaySOD.getFullYear(), todaySOD.getMonth() + i + 1, 1)
    const covering    = activeContractsParsed.filter(c => c.startDateObj < monthEnd && c.endDateObj > monthStart)
    return {
      label:         monthStart.toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' }),
      expected:      covering.reduce((s, c) => s + c.monthlyPrice, 0),
      contractCount: covering.length,
    }
  })

  return (
    <FinanceView
      activeContracts={sortedActive}
      activeCount={activeCount}
      totalMonthlyRevenue={totalMonthlyRevenue}
      avgDuration={avgDuration}
      avgMonthlyPrice={avgMonthlyPrice}
      forecast={forecast}
      forecastMonths={FORECAST_MONTHS}
    />
  )
}
