'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { buildHabitGraph } from './habitGraph'
import type { GraphRange, HabitHistoryEntry } from './types'

const GOLD = 'rgb(212, 175, 55)'
const CHART_HEIGHT = 192

function safeLabel(iso: string): string {
  try {
    return format(parseISO(iso), 'MMM d')
  } catch {
    return iso
  }
}

/**
 * Habit completion curve. The SVG viewBox always equals the measured pixel
 * size of its container (ResizeObserver), so nothing is ever scaled and the
 * axis text can never distort. Hover on desktop, drag/tap on touch screens.
 */
export function HabitChart({
  habitHistory,
  range,
}: {
  habitHistory: HabitHistoryEntry[]
  range: GraphRange
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0)
      setWidth(prev => (prev === w ? prev : w))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const graph = useMemo(
    () => buildHabitGraph(habitHistory, range, width, CHART_HEIGHT),
    [habitHistory, range, width],
  )

  const pickPoint = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!graph) return
    const rect = e.currentTarget.getBoundingClientRect()
    const idx = Math.round((e.clientX - rect.left - graph.padding.left) / graph.stepX)
    setHover(Math.max(0, Math.min(graph.points.length - 1, idx)))
  }

  const hoverPoint = graph && hover != null ? graph.points[hover] : undefined

  return (
    <div
      ref={wrapRef}
      className="relative w-full select-none"
      style={{ height: CHART_HEIGHT, touchAction: 'pan-y' }}
      data-cursor="Explore"
      onPointerDown={pickPoint}
      onPointerMove={pickPoint}
      onPointerLeave={e => {
        // Touch keeps its last readout until the next tap; only a mouse "leaves".
        if (e.pointerType === 'mouse') setHover(null)
      }}
    >
      {graph && (
        <svg
          width={graph.width}
          height={graph.height}
          viewBox={`0 0 ${graph.width} ${graph.height}`}
          className="block"
          role="img"
          aria-label="Habit completion over time"
        >
          <defs>
            <linearGradient id="habitGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GOLD} stopOpacity="0.35" />
              <stop offset="30%" stopColor={GOLD} stopOpacity="0.2" />
              <stop offset="70%" stopColor={GOLD} stopOpacity="0.1" />
              <stop offset="100%" stopColor={GOLD} stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="bottomGlow" x1="0" y1="0.7" x2="0" y2="1">
              <stop offset="0%" stopColor={GOLD} stopOpacity="0" />
              <stop offset="100%" stopColor={GOLD} stopOpacity="0.25" />
            </linearGradient>
            <filter id="habitGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {[0, 25, 50, 75, 100].map(pct => {
            const y = graph.padding.top + graph.chartH - (pct / 100) * graph.chartH
            return (
              <g key={pct}>
                <line x1={graph.padding.left} y1={y} x2={graph.width - graph.padding.right} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3,4" />
                <text x={graph.padding.left - 8} y={y + 3.5} textAnchor="end" fontSize="10" fontWeight="500" className="fill-ink/40 font-mono">{pct}%</text>
              </g>
            )
          })}

          <rect x={graph.padding.left} y={graph.padding.top + graph.chartH} width={graph.chartW} height={2} fill={GOLD} opacity="0.15" rx="1" />
          <path d={graph.areaPath} fill="url(#habitGradient)" />
          <path d={graph.areaPath} fill="url(#bottomGlow)" />
          <path d={graph.smoothPath} fill="none" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#habitGlow)" opacity="0.95" pathLength={1} strokeDasharray={1} className="graph-draw" />

          {hoverPoint && (
            <g pointerEvents="none">
              <line x1={hoverPoint.x} y1={graph.padding.top} x2={hoverPoint.x} y2={graph.padding.top + graph.chartH} stroke="rgba(243,239,230,0.25)" strokeWidth="1" />
              <circle cx={hoverPoint.x} cy={hoverPoint.y} r="4.5" fill="#f3efe6" stroke={GOLD} strokeWidth="2" />
            </g>
          )}

          {(() => {
            // Fewer labels on narrow charts so they never collide.
            const total = graph.dates.length
            const wanted = width < 360 ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1]
            const idxs = wanted
              .map(f => (f === 1 ? total - 1 : Math.floor(total * f)))
              .filter((v, i, a) => a.indexOf(v) === i)
            return idxs.map((idx, i) => {
              const pt = graph.points[idx]
              if (!pt) return null
              const anchor = i === 0 ? 'start' : i === idxs.length - 1 ? 'end' : 'middle'
              return (
                <text key={idx} x={pt.x} y={graph.padding.top + graph.chartH + 18} textAnchor={anchor} fontSize="10" fontWeight="500" className="fill-ink/50 font-mono">
                  {safeLabel(graph.dates[idx])}
                </text>
              )
            })
          })()}
        </svg>
      )}

      {graph && hoverPoint && (
        <div
          className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-gold-dim/30 bg-surface-solid px-2 py-1 font-mono text-[11px] shadow-lg"
          style={{
            left: Math.max(40, Math.min(graph.width - 40, hoverPoint.x)),
            top: hoverPoint.y,
            transform: 'translate(-50%, -130%)',
          }}
        >
          <span className="text-parchment/70">{safeLabel(hoverPoint.date)}</span>
          <span className="ml-1.5 font-bold text-gold">{Math.round(hoverPoint.rawRate)}%</span>
        </div>
      )}
    </div>
  )
}
