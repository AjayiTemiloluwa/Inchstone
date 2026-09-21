'use client'

import { useId, useSyncExternalStore } from 'react'
import { format } from 'date-fns'
import { useCountdown } from '@/lib/useCountdown'

/**
 * The signature instrument — a **live work clock** (it replaces the v2 compass).
 *
 * Same object, same read: one ring around the dial (how much of the current
 * period's work is done), mono complications inside it (the day number and the
 * one gold number), tap to open the full year. What changed is the middle — the
 * alignment needle is gone and the hands are the *real local time*: hour,
 * minute, and a thin gold-dim second hand that ticks every second, so the
 * instrument is genuinely live wherever it sits.
 *
 * House rules this follows:
 * - "Now" comes from the shared `useCountdown` ticker — never a private
 *   setInterval (LIVING_APP_STYLE_GUIDE §1, one source for time).
 * - Hydration: the hands rest at 12:00 in the server snapshot and settle to the
 *   real time one paint later (the dashboard's `useSyncExternalStore` mounted
 *   pattern) — no mismatch, no setState-in-effect render cascade.
 * - A clock must stay truthful under `prefers-reduced-motion`, so the ticker is
 *   asked to keep ticking; the global reduced-motion rule in `globals.css`
 *   flattens the hand-settle transitions instead of freezing the read.
 * - Geometry is proportional to `size`, so one component covers the 22px chrome
 *   mark, the 40px empty-state glyph, and the 200px dashboard hero.
 */
interface WorkClockProps {
  /** 0-100 — how much of the current period's work is done (the ring) */
  progress?: number
  /** the single gold number on the dial, e.g. "68" (alignment %) */
  primary?: string
  /** mono complication above the centre, e.g. "034" (day of year) */
  dayLabel?: string
  /** mono caption under the number, e.g. "TODAY" */
  ringLabel?: string
  size?: number
  /** also print the live HH:mm beside the dial (chrome marks / topbar) */
  showTime?: boolean
  onClick?: () => void
  interactiveLabel?: string
  className?: string
}

const noopSubscribe = () => () => {}

/* Server-snapshot pose — hands at 12:00 so SSR and the first client paint agree. */
const RESTING_HOUR = 0
const RESTING_MINUTE = 0
const RESTING_SECOND = 0

export function WorkClock({
  progress = 0,
  primary,
  dayLabel,
  ringLabel,
  size = 220,
  showTime = false,
  onClick,
  interactiveLabel = 'Open year view',
  className = '',
}: WorkClockProps) {
  const gradId = useId()
  const now = useCountdown(1000, { respectReducedMotion: false })
  const ready = useSyncExternalStore(noopSubscribe, () => true, () => false)

  const safeProgress = Math.min(100, Math.max(0, progress))
  const ringStroke = Math.max(2, Math.min(size * 0.05, 9))
  const r = (size - ringStroke) / 2 - size * 0.045
  const circ = 2 * Math.PI * r
  const ringOffset = circ - (safeProgress / 100) * circ
  const cx = size / 2

  const seconds = ready ? now.getSeconds() : RESTING_SECOND
  const minutes = ready ? now.getMinutes() : RESTING_MINUTE
  const hours = ready ? now.getHours() % 12 : RESTING_HOUR
  const secondDeg = seconds * 6
  const minuteDeg = minutes * 6 + seconds * 0.1
  const hourDeg = hours * 30 + minutes * 0.5

  /* Below ~44px there is no room for complications or a 12-index chapter ring. */
  const compact = size < 44
  const tickAngles = compact ? [0, 90, 180, 270] : Array.from({ length: 12 }, (_, i) => i * 30)
  const tickOuter = r - size * 0.012

  const timeText = ready ? format(now, 'HH:mm') : '--:--'
  const ariaLabel = `Work clock, ${ready ? format(now, 'HH:mm') : 'reading the time'}${
    primary ? `, ${primary}%${ringLabel ? ` ${ringLabel.toLowerCase()}` : ''}` : ''
  }${dayLabel ? `, day ${dayLabel}` : ''}`

  const face = (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#b8935a" />
          <stop offset="100%" stopColor="#8a6d42" />
        </linearGradient>
      </defs>

      {/* Dial face */}
      <circle cx={cx} cy={cx} r={r} fill="rgba(243,239,230,0.03)" />

      {/* Track ring + the work done in the current period */}
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke="rgba(138,109,66,0.28)"
        strokeWidth={ringStroke}
      />
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={ringStroke}
        strokeLinecap="butt"
        strokeDasharray={circ}
        strokeDashoffset={ringOffset}
        transform={`rotate(-90 ${cx} ${cx})`}
        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }}
      />

      {/* Chapter ring — 12 hour indices, cardinals a little longer */}
      {tickAngles.map((a) => {
        const long = a % 90 === 0
        return (
          <line
            key={a}
            x1={cx}
            y1={tickOuter}
            x2={cx}
            y2={tickOuter - (long ? size * 0.075 : size * 0.04)}
            stroke={long ? 'rgba(243,239,230,0.35)' : 'rgba(243,239,230,0.18)'}
            strokeWidth={long ? 1.5 : 1}
            transform={`rotate(${a} ${cx} ${cx})`}
          />
        )
      })}

      {/* Hour hand */}
      <g
        transform={`rotate(${hourDeg} ${cx} ${cx})`}
        style={{ transition: 'transform 0.6s cubic-bezier(0.4,0,0.2,1)' }}
      >
        <line
          x1={cx}
          y1={cx}
          x2={cx}
          y2={cx - size * 0.24}
          stroke="#b8935a"
          strokeWidth={Math.max(2, size * 0.028)}
          strokeLinecap="round"
        />
      </g>

      {/* Minute hand */}
      <g
        transform={`rotate(${minuteDeg} ${cx} ${cx})`}
        style={{ transition: 'transform 0.6s cubic-bezier(0.4,0,0.2,1)' }}
      >
        <line
          x1={cx}
          y1={cx}
          x2={cx}
          y2={cx - size * 0.33}
          stroke="rgba(243,239,230,0.85)"
          strokeWidth={Math.max(1.5, size * 0.02)}
          strokeLinecap="round"
        />
      </g>

      {/* Second hand — the tick that makes it live (short counterweight tail) */}
      <g
        transform={`rotate(${secondDeg} ${cx} ${cx})`}
        style={{ transition: 'transform 0.25s linear' }}
      >
        <line
          x1={cx}
          y1={cx + size * 0.07}
          x2={cx}
          y2={cx - size * 0.36}
          stroke="#8a6d42"
          strokeWidth={Math.max(1, size * 0.011)}
          strokeLinecap="round"
        />
      </g>

      {/* Centre pin */}
      <circle cx={cx} cy={cx} r={Math.max(1.8, size * 0.02)} fill="#b8935a" />
      <circle cx={cx} cy={cx} r={Math.max(0.9, size * 0.009)} fill="#0a0908" />

      {/* Mono complications — the same three readings the compass carried */}
      {!compact && dayLabel && (
        <text
          x={cx}
          y={cx - size * 0.3}
          textAnchor="middle"
          fill="rgba(243,239,230,0.55)"
          fontFamily="var(--font-jetbrains-mono), monospace"
          fontSize={size * 0.06}
        >
          {dayLabel}
        </text>
      )}
      {!compact && primary && (
        <text
          x={cx}
          y={cx + size * 0.13}
          textAnchor="middle"
          fill="#b8935a"
          fontFamily="var(--font-jetbrains-mono), monospace"
          fontWeight={700}
          fontSize={size * 0.115}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {primary}
        </text>
      )}
      {!compact && ringLabel && (
        <text
          x={cx}
          y={cx + size * 0.21}
          textAnchor="middle"
          fill="rgba(243,239,230,0.5)"
          fontFamily="var(--font-jetbrains-mono), monospace"
          fontSize={size * 0.048}
          letterSpacing="0.08em"
        >
          {ringLabel}
        </text>
      )}
    </svg>
  )

  /* Optional live HH:mm beside the dial (topbar chrome mark) */
  const timeLabel = showTime ? (
    <span
      suppressHydrationWarning
      className="font-mono text-[11px] tabular-nums text-parchment/60"
    >
      {timeText}
    </span>
  ) : null

  if (!onClick) {
    return (
      <span className={`inline-flex items-center gap-2 ${className}`}>
        {face}
        {timeLabel}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={interactiveLabel}
      className={`inline-flex cursor-pointer items-center gap-2 rounded-full focus-visible:outline-2 focus-visible:outline-gold ${className}`}
    >
      {face}
      {timeLabel}
    </button>
  )
}

