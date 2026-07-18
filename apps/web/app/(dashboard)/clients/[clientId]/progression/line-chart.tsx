'use client'

import { useState } from 'react'

export interface ChartPoint {
  date: string   // YYYY-MM-DD
  value: number
}

interface Props {
  data: ChartPoint[]
  color: string
  unit: string
  height?: number
  decimals?: number
}

const W = 560
const PAD = { top: 24, right: 16, bottom: 28, left: 44 }

export function LineChart({ data, color, unit, height = 160, decimals = 1 }: Props) {
  const [hovered, setHovered] = useState<number | null>(null)

  if (data.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center text-gray-300 gap-1"
        style={{ height }}
      >
        <svg viewBox="0 0 40 24" className="w-10 h-6 opacity-30">
          <polyline points="0,20 10,12 20,16 30,8 40,4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="text-xs text-gray-400">Ingen data ennå</span>
      </div>
    )
  }

  if (data.length === 1) {
    const H = height
    const cx = W / 2
    const cy = H / 2
    const label = new Date(data[0].date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
    return (
      <div className="relative select-none">
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
          <circle cx={cx} cy={cy} r={6} fill="white" stroke={color} strokeWidth={2.5} />
          <text x={cx} y={cy - 14} textAnchor="middle" fontSize={13} fontWeight="700" fill={color}>
            {data[0].value.toFixed(decimals)} {unit}
          </text>
          <text x={cx} y={cy + 20} textAnchor="middle" fontSize={10} fill="#9ca3af">
            {label}
          </text>
        </svg>
      </div>
    )
  }

  const H = height
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const vals = data.map(d => d.value)
  const minV = Math.min(...vals)
  const maxV = Math.max(...vals)
  const rangeV = maxV - minV || 1
  const pad = rangeV * 0.12

  const yMin = minV - pad
  const yMax = maxV + pad
  const yRange = yMax - yMin

  function sx(i: number) {
    return PAD.left + (i / (data.length - 1)) * innerW
  }
  function sy(v: number) {
    return PAD.top + innerH * (1 - (v - yMin) / yRange)
  }

  // Smooth Catmull-Rom path
  const pts = data.map((d, i) => ({ x: sx(i), y: sy(d.value) }))

  let linePath = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    linePath += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
  }

  const areaPath =
    linePath +
    ` L ${pts[pts.length - 1].x},${H - PAD.bottom}` +
    ` L ${PAD.left},${H - PAD.bottom} Z`

  // Y-axis labels (4 gridlines)
  const gridCount = 4
  const yLabels = Array.from({ length: gridCount + 1 }, (_, i) => {
    const v = yMin + (yRange * i) / gridCount
    return { y: sy(v), label: v.toFixed(decimals) }
  })

  // X-axis labels (up to 5 dates, spaced evenly)
  const step = Math.max(1, Math.floor(data.length / 5))
  const xLabels = data
    .map((d, i) => ({ i, d }))
    .filter(({ i }) => i % step === 0 || i === data.length - 1)
    .map(({ i, d }) => ({
      x: sx(i),
      label: new Date(d.date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }),
    }))

  const gradId = `grad-${color.replace(/[^a-z0-9]/gi, '')}`

  return (
    <div className="relative select-none">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: H }}
        className="overflow-visible"
        onMouseLeave={() => setHovered(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {yLabels.map((g, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={g.y} x2={W - PAD.right} y2={g.y}
              stroke="#f3f4f6" strokeWidth={1} />
            <text x={PAD.left - 5} y={g.y} textAnchor="end" dominantBaseline="middle"
              fontSize={9} fill="#d1d5db">
              {g.label}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill={`url(#${gradId})`} />

        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth={2.5}
          strokeLinecap="round" strokeLinejoin="round" />

        {/* Interactive data points + hover zones */}
        {pts.map((p, i) => (
          <g key={i}>
            {/* Large invisible hit zone */}
            <rect
              x={i === 0 ? PAD.left : (pts[i - 1].x + p.x) / 2}
              y={PAD.top}
              width={
                i === 0 ? (pts[1].x - p.x) / 2
                : i === pts.length - 1 ? p.x - (pts[i - 1].x + p.x) / 2
                : (pts[i + 1].x - pts[i - 1].x) / 2
              }
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHovered(i)}
            />
            {/* Dot */}
            <circle
              cx={p.x} cy={p.y} r={hovered === i ? 5 : 3.5}
              fill="white" stroke={color}
              strokeWidth={hovered === i ? 2.5 : 2}
              style={{ transition: 'r 80ms, stroke-width 80ms' }}
            />
          </g>
        ))}

        {/* Tooltip */}
        {hovered !== null && (() => {
          const p = pts[hovered]
          const d = data[hovered]
          const tipW = 82
          const tipH = 38
          const tipX = Math.min(Math.max(p.x - tipW / 2, PAD.left), W - PAD.right - tipW)
          const tipY = p.y - tipH - 10
          return (
            <g>
              <line x1={p.x} y1={p.y} x2={p.x} y2={H - PAD.bottom}
                stroke={color} strokeWidth={1} strokeDasharray="3,3" opacity={0.5} />
              <rect x={tipX} y={tipY} width={tipW} height={tipH}
                rx={7} fill="#111827" opacity={0.92} />
              <text x={tipX + tipW / 2} y={tipY + 14}
                textAnchor="middle" fontSize={12} fill="white" fontWeight="700">
                {d.value.toFixed(decimals)} {unit}
              </text>
              <text x={tipX + tipW / 2} y={tipY + 28}
                textAnchor="middle" fontSize={9.5} fill="#9ca3af">
                {new Date(d.date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}
              </text>
            </g>
          )
        })()}

        {/* X labels */}
        {xLabels.map((l, i) => (
          <text key={i} x={l.x} y={H - 4}
            textAnchor="middle" fontSize={9} fill="#d1d5db">
            {l.label}
          </text>
        ))}
      </svg>
    </div>
  )
}
