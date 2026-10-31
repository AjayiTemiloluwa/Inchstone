import { format, parseISO } from 'date-fns'
import type { ReportDay } from '@/lib/reports/types'

/**
 * Lightweight SVG charts built on the app's quiet token palette
 * (gold / moss / ember / parchment — no neon). Pure render, no deps.
 *
 * Every colour is derived from the theme tokens (CSS custom properties), so
 * the charts follow light and dark mode. The "lifted" data hues mix a token
 * toward the text colour: lighter on dark ink, deeper on light paper, which
 * keeps bars legible against either background. Colours are applied through
 * `style` (not SVG presentation attributes) so `var()` always resolves.
 */
const tok = (name: string, alpha = 1) => `rgb(var(--${name}-rgb) / ${alpha})`
const lift = (name: string, pct: number) =>
    `color-mix(in srgb, rgb(var(--${name}-rgb)) ${pct}%, rgb(var(--parchment-rgb)))`

const PALETTE = {
    moss: tok('moss'),
    mossLight: lift('moss', 70),
    gold: tok('gold'),
    goldDim: tok('gold-dim'),
    ember: lift('ember', 70),
    parchment: tok('parchment'),
    parchmentDim: tok('parchment', 0.55),
    hairline: tok('gold', 0.2),
    faint: tok('parchment', 0.1),
}

/** Colour a day's bar based on where its score sits in the banding. */
export function scoreColor(score: number, active: boolean): string {
    if (!active) return PALETTE.faint
    if (score >= 100) return PALETTE.mossLight
    if (score >= 40) return PALETTE.gold
    return PALETTE.ember
}

export function relativeTrend(a: number, b: number): string {
    const diff = a - b
    if (diff === 0) return '±0'
    return diff > 0 ? `+${diff}` : `${diff}`
}
/**
 * Daily score bar chart. Dense weeks/years degrade into fact bars with a
 * dotted gridline at the average and sparse labels.
 */
export function ScoreBarChart({
    days,
    height = 200,
}: { days: ReportDay[]; height?: number }) {
    if (!days.length) return null
    const W = 1000
    const H = height
    const padB = 24
    const padT = 10
    const plotH = H - padB - padT
    const n = days.length
    const slot = W / n
    const barW = Math.max(3, slot * 0.7)
    const maxScore = 100

    const avg = days.length
        ? days.reduce((s, d) => s + d.score, 0) / days.length
        : 0

    // Show a readable subset of date labels along the x axis.
    const labelStep = Math.max(1, Math.ceil(n / 12))
    const yFor = (v: number) => padT + plotH * (1 - v / maxScore)

    return (
        <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            role="img"
            aria-label="Daily completion score bar chart"
        >
            <line x1={0} y1={yFor(0)} x2={W} y2={yFor(0)} style={{ stroke: PALETTE.hairline }} strokeWidth={1} />
            {avg > 0 && (
                <line x1={0} y1={yFor(avg)} x2={W} y2={yFor(avg)}
                    style={{ stroke: PALETTE.parchmentDim }} strokeWidth={1} strokeDasharray="4 4" opacity={0.45} />
            )}
            {days.map((d, i) => {
                const x = i * slot + (slot - barW) / 2
                const h = Math.max(0, (d.score / maxScore) * plotH)
                const y = yFor(d.score)
                const color = scoreColor(d.score, d.active)
                const showLabel = i % labelStep === 0 || i === n - 1
                return (
                    <g key={d.date}>
                        <rect
                            x={x} y={y} width={barW} height={Math.max(h, 0)}
                            rx={2} style={{ fill: color }}
                            opacity={d.active ? 1 : 0.35}
                        >
                            <title>{`${format(parseISO(d.date), 'EEE, MMM d')} — ${d.score}% (${d.completed}/${d.total} done)`}</title>
                        </rect>
                        {showLabel && (
                            <text
                                x={x + barW / 2} y={H - 6}
                                textAnchor="middle"
                                fontSize={11}
                                className="font-mono"
                                style={{ fill: PALETTE.parchmentDim }}
                            >
                                {format(parseISO(d.date), 'd MMM')}
                            </text>
                        )}
                    </g>
                )
            })}
            <text x={W - 4} y={padT - 4} textAnchor="end" fontSize={11} className="font-mono" style={{ fill: PALETTE.parchmentDim }}>%</text>
        </svg>
    )
}
/** Graduated completion donut (done moss, remaining parchment). */
export function CompletionDonut({
    scored,
    max,
    size = 150,
    thickness = 14,
}: { scored: number; max: number; size?: number; thickness?: number }) {
    const pct = max > 0 ? Math.round((scored / max) * 100) : 0
    const r = (size - thickness) / 2
    const c = 2 * Math.PI * r
    const filled = max > 0 ? (scored / max) * c : 0
    const cx = size / 2

    return (
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 sm:justify-start">
            <svg width={size} height={size} className="-rotate-90 shrink-0" role="img"
                aria-label={`${pct}% completion`}>
                <circle style={{ stroke: PALETTE.hairline }} strokeWidth={thickness} fill="transparent"
                    r={r} cx={cx} cy={cx} />
                <circle style={{ stroke: PALETTE.mossLight }} strokeWidth={thickness} fill="transparent"
                    strokeDasharray={c} strokeDashoffset={c - filled}
                    strokeLinecap="round" r={r} cx={cx} cy={cx} />
            </svg>
            <div className="flex flex-col">
                <span className="font-display text-[2.25rem] leading-none text-parchment tabular-nums">{pct}%</span>
                <span className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/45">Weighted completion</span>
                <span className="mt-1 font-mono text-mono text-parchment/50 tabular-nums">
                    {Math.round(scored)} / {Math.round(max)} pts
                </span>
            </div>
        </div>
    )
}

/** Horizontal two-tone breakdown bars for categories / priorities. */
export function BreakdownBars({ rows, color = 'moss' }: {
    rows: { label: string; total: number; completed: number }[]
    color?: 'moss' | 'gold' | 'ember'
}) {
    const fill = color === 'moss' ? PALETTE.mossLight : color === 'ember' ? PALETTE.ember : PALETTE.gold
    const maxTotal = Math.max(1, ...rows.map(r => r.total))
    if (!rows.length) {
        return <p className="text-caption text-parchment/45">No tasks in this range.</p>
    }
    return (
        <div className="space-y-4">
            {rows.map(r => {
                const pct = r.total ? Math.round((r.completed / r.total) * 100) : 0
                const share = (r.total / maxTotal) * 100
                return (
                    <div key={r.label}>
                        <div className="mb-1.5 flex items-baseline justify-between gap-2">
                            <span className="truncate text-body text-parchment">{r.label}</span>
                            <span className="shrink-0 font-mono text-mono text-parchment/50 tabular-nums">
                                {r.completed}/{r.total} · {pct}%
                            </span>
                        </div>
                        <div className="flex h-2 w-full overflow-hidden rounded-full bg-parchment/[0.06]">
                            <div className="h-full" style={{ width: `${pct}%`, backgroundColor: fill }} />
                            <div className="h-full" style={{ backgroundColor: PALETTE.faint, flex: `0 1 ${100 - pct}%` }} />
                        </div>
                        <div className="sr-only">{`${r.label} — ${share.toFixed(0)}% of tasks`}</div>
                    </div>
                )
            })}
        </div>
    )
}
