'use client'

import { useState, useMemo } from 'react'
import { LineChart } from './line-chart'
import { Scale, Moon, Footprints, Zap } from 'lucide-react'

type Filter = 'uke' | 'måned' | 'alt'

interface MetricRow {
  date: string
  weight_kg:    number | null
  sleep_hours:  number | null
  steps:        number | null
  energy_level: number | null
  mood:         number | null
}

interface Props {
  data: MetricRow[]
}

const DAY = 86_400_000

function periodRange(filter: Filter) {
  const now = Date.now()
  if (filter === 'uke') {
    return { currentStart: now - 7 * DAY, prevStart: now - 14 * DAY, prevEnd: now - 7 * DAY }
  }
  if (filter === 'måned') {
    return { currentStart: now - 30 * DAY, prevStart: now - 60 * DAY, prevEnd: now - 30 * DAY }
  }
  return { currentStart: 0, prevStart: null, prevEnd: null }
}

function calcStats(vals: number[]) {
  if (!vals.length) return null
  const sum = vals.reduce((a, b) => a + b, 0)
  return {
    avg: sum / vals.length,
    min: Math.min(...vals),
    max: Math.max(...vals),
    count: vals.length,
  }
}

const FILTER_LABELS: Filter[] = ['uke', 'måned', 'alt']

export function ProgressionView({ data }: Props) {
  const [filter, setFilter] = useState<Filter>('alt')

  const { currentStart, prevStart, prevEnd } = useMemo(() => periodRange(filter), [filter])

  const filtered = useMemo(
    () => data.filter(r => new Date(r.date).getTime() >= currentStart),
    [data, currentStart],
  )

  const prevFiltered = useMemo(() => {
    if (prevStart == null || prevEnd == null) return []
    return data.filter(r => {
      const t = new Date(r.date).getTime()
      return t >= prevStart && t < prevEnd
    })
  }, [data, prevStart, prevEnd])

  const weightData  = filtered.filter(r => r.weight_kg    != null).map(r => ({ date: r.date, value: r.weight_kg!    }))
  const sleepData   = filtered.filter(r => r.sleep_hours  != null).map(r => ({ date: r.date, value: r.sleep_hours!  }))
  const stepsData   = filtered.filter(r => r.steps        != null).map(r => ({ date: r.date, value: r.steps!        }))
  const energyData  = filtered.filter(r => r.energy_level != null).map(r => ({ date: r.date, value: r.energy_level! }))

  const wStats  = calcStats(weightData.map(d => d.value))
  const sStats  = calcStats(sleepData.map(d => d.value))
  const stStats = calcStats(stepsData.map(d => d.value))
  const eStats  = calcStats(energyData.map(d => d.value))

  const prevWStats  = calcStats(prevFiltered.filter(r => r.weight_kg    != null).map(r => r.weight_kg!))
  const prevSStats  = calcStats(prevFiltered.filter(r => r.sleep_hours  != null).map(r => r.sleep_hours!))
  const prevStStats = calcStats(prevFiltered.filter(r => r.steps        != null).map(r => r.steps!))
  const prevEStats  = calcStats(prevFiltered.filter(r => r.energy_level != null).map(r => r.energy_level!))

  const periodLabel = filter === 'uke' ? 'forrige uke' : filter === 'måned' ? 'forrige måned' : null

  const hasAnyData = weightData.length + sleepData.length + stepsData.length + energyData.length > 0

  return (
    <div className="space-y-5">
      {/* Filter */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {FILTER_LABELS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 h-7 rounded-lg text-xs font-semibold capitalize transition-all ${
              filter === f
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f === 'alt' ? 'Alt' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {!hasAnyData ? (
        <div className="py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Scale className="w-6 h-6 text-gray-300" />
          </div>
          <p className="font-medium text-gray-500">Ingen målinger registrert</p>
          <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
            Vekt, søvn, skritt og energinivå logges automatisk fra klientens daglige check-ins.
          </p>
        </div>
      ) : (
        <>
          {/* ── Metric summary cards ──────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              icon={<Scale className="w-4 h-4" />}
              label="Vekt"
              color="blue"
              unit="kg"
              stats={wStats}
              prevAvg={prevWStats?.avg ?? null}
              decimals={1}
              isGoodWhenDown
              periodLabel={periodLabel}
            />
            <MetricCard
              icon={<Moon className="w-4 h-4" />}
              label="Søvn"
              color="violet"
              unit="t"
              stats={sStats}
              prevAvg={prevSStats?.avg ?? null}
              decimals={1}
              isGoodWhenDown={false}
              periodLabel={periodLabel}
            />
            <MetricCard
              icon={<Footprints className="w-4 h-4" />}
              label="Skritt"
              color="green"
              unit=""
              stats={stStats ? { ...stStats,
                avg: Math.round(stStats.avg),
                min: Math.round(stStats.min),
                max: Math.round(stStats.max),
              } : null}
              prevAvg={prevStStats ? Math.round(prevStStats.avg) : null}
              decimals={0}
              isGoodWhenDown={false}
              periodLabel={periodLabel}
            />
            <MetricCard
              icon={<Zap className="w-4 h-4" />}
              label="Energi"
              color="amber"
              unit="/10"
              stats={eStats}
              prevAvg={prevEStats?.avg ?? null}
              decimals={1}
              isGoodWhenDown={false}
              periodLabel={periodLabel}
            />
          </div>

          {/* ── Chart cards ─────────────────────────────────── */}
          <div className="space-y-4">
            <ChartCard
              title="Vekt (kg)"
              subtitle={wStats ? `Snitt ${wStats.avg.toFixed(1)} kg` : undefined}
              icon={<Scale className="w-3.5 h-3.5 text-[#2d8653]" />}
            >
              <LineChart data={weightData} color="#3b82f6" unit="kg" height={160} decimals={1} />
            </ChartCard>

            <ChartCard
              title="Energinivå (1–10)"
              subtitle={eStats ? `Snitt ${eStats.avg.toFixed(1)}` : undefined}
              icon={<Zap className="w-3.5 h-3.5 text-amber-500" />}
            >
              <LineChart data={energyData} color="#f59e0b" unit="" height={140} decimals={1} />
            </ChartCard>

            <ChartCard
              title="Søvn (timer)"
              subtitle={sStats ? `Snitt ${sStats.avg.toFixed(1)}t` : undefined}
              icon={<Moon className="w-3.5 h-3.5 text-violet-500" />}
            >
              <LineChart data={sleepData} color="#8b5cf6" unit="t" height={140} decimals={1} />
            </ChartCard>
          </div>
        </>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

interface MetricCardProps {
  icon: React.ReactNode
  label: string
  color: 'blue' | 'violet' | 'green' | 'amber'
  unit: string
  stats: { avg: number; min: number; max: number; count: number } | null
  prevAvg: number | null
  decimals: number
  isGoodWhenDown: boolean
  periodLabel: string | null
}

const COLOR_MAP = {
  blue:   { bg: 'bg-[#ebf5ef]',  icon: 'bg-[#cdeee3] text-[#2d8653]',  val: 'text-[#1a5c3a]',  sub: 'text-[#6ecfb0]'  },
  violet: { bg: 'bg-violet-50',  icon: 'bg-violet-100 text-violet-600', val: 'text-violet-900', sub: 'text-violet-400' },
  green:  { bg: 'bg-green-50',   icon: 'bg-green-100 text-green-600',   val: 'text-green-900',  sub: 'text-green-400'  },
  amber:  { bg: 'bg-amber-50',   icon: 'bg-amber-100 text-amber-600',   val: 'text-amber-900',  sub: 'text-amber-400'  },
}

function MetricCard({ icon, label, color, unit, stats, prevAvg, decimals, isGoodWhenDown, periodLabel }: MetricCardProps) {
  const c = COLOR_MAP[color]

  let delta: number | null = null
  let deltaColor = 'text-gray-400'
  let arrow = ''

  if (stats && prevAvg != null) {
    delta = stats.avg - prevAvg
    const isImprovement = isGoodWhenDown ? delta < 0 : delta > 0
    deltaColor = isImprovement ? 'text-emerald-500' : delta === 0 ? 'text-gray-400' : 'text-red-400'
    arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→'
  }

  return (
    <div className={`${c.bg} rounded-2xl p-4`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${c.icon}`}>
          {icon}
        </span>
        <span className={`text-[10px] font-bold uppercase tracking-wider ${c.sub}`}>{label}</span>
      </div>
      {stats ? (
        <>
          <p className={`text-2xl font-bold ${c.val}`}>
            {stats.avg.toFixed(decimals)}{unit && <span className="text-base font-semibold ml-0.5">{unit}</span>}
          </p>
          <p className={`text-[10px] font-medium mt-0.5 mb-2 ${c.sub}`}>Snitt</p>

          {delta != null && periodLabel && (
            <p className={`text-xs font-semibold mb-2 ${deltaColor}`}>
              {arrow} {Math.abs(delta).toFixed(decimals)}{unit} vs {periodLabel}
            </p>
          )}

          <div className={`mt-2 space-y-0.5 text-xs ${c.sub}`}>
            <div className="flex justify-between">
              <span>Min</span><span className="font-semibold">{stats.min.toFixed(decimals)}{unit}</span>
            </div>
            <div className="flex justify-between">
              <span>Max</span><span className="font-semibold">{stats.max.toFixed(decimals)}{unit}</span>
            </div>
            <div className="flex justify-between">
              <span>Målinger</span><span className="font-semibold">{stats.count}</span>
            </div>
          </div>
        </>
      ) : (
        <p className={`text-sm font-semibold ${c.sub}`}>Ingen data</p>
      )}
    </div>
  )
}

function ChartCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string
  subtitle?: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
        <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          {icon}
          {title}
        </h4>
        {subtitle && <span className="text-xs text-gray-400">{subtitle}</span>}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  )
}
