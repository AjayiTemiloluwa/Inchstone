'use client'

import { useId } from 'react'

/**
 * The signature instrument (v1 A5 / v2 A).
 * v2 cut: show ONE ring (the current layer) around the needle, not five.
 * The day number + alignment % sit inside the face as mono numerals (watch-complication),
 * so there is no separate caption line under the compass.
 *
 * Needle orientation = alignment (0-100). Higher alignment sweeps the needle clockwise.
 * The settle uses a CSS cubic-bezier transition; `prefers-reduced-motion` flattens it.
 */
interface CompassProps {
  /** 0-100 — today's alignment with the active layer's Why/goal */
  alignment?: number
  /** 0-100 — progress of the currently-shown layer's ring */
  ringProgress?: number
  /** e.g. "034" — day-of-year shown as mono complication */
  dayLabel?: string
  /** e.g. "68" — the single gold number (alignment %), passed separately */
  primary?: string
  /** secondary mono complication, e.g. layer name "WIN" */
  ringLabel?: string
  size?: number
  onClick?: () => void
  interactiveLabel?: string
  className?: string
}

export function Compass({
  alignment = 0,
  ringProgress = 0,
  dayLabel,
  primary,
  ringLabel,
  size = 220,
  onClick,
  interactiveLabel = 'Open year view',
  className = '',
}: CompassProps) {
  const gradId = useId()
  const safeAlignment = Math.min(100, Math.max(0, alignment))
  const safeRing = Math.min(100, Math.max(0, ringProgress))
  const stroke = Math.max(6, size * 0.04)
  const r = (size - stroke) / 2 - size * 0.06
  const circ = 2 * Math.PI * r
  const ringOffset = circ - (safeRing / 100) * circ
  const needleDeg = (safeAlignment / 100) * 360
  const cx = size / 2

  const content = (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${primary ?? Math.round(safeAlignment)}%${ringLabel ? ` ${ringLabel}` : ''}${dayLabel ? `, day ${dayLabel}` : ''} aligned`}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#b8935a" />
          <stop offset="100%" stopColor="#8a6d42" />
        </linearGradient>
      </defs>

      {/* Track ring */}
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke="rgba(138,109,66,0.28)"
        strokeWidth={stroke}
      />
      {/* Active layer ring (gold when progressing, gold-dim track otherwise) */}
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={stroke}
        strokeLinecap="butt"
        strokeDasharray={circ}
        strokeDashoffset={ringOffset}
        transform={`rotate(-90 ${cx} ${cx})`}
        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }}
      />

      {/* Cardinal ticks */}
      {[0, 90, 180, 270].map((a) => (
        <line
          key={a}
          x1={cx}
          y1={size * 0.08}
          x2={cx}
          y2={size * 0.14}
          stroke="rgba(243,239,230,0.35)"
          strokeWidth={1.5}
          transform={`rotate(${a} ${cx} ${cx})`}
        />
      ))}

      {/* Needle — settles to alignment */}
      <g
        transform={`rotate(${needleDeg} ${cx} ${cx})`}
        style={{ transition: 'transform 0.9s cubic-bezier(0.25,1,0.35,1)' }}
      >
        {/* north (gold) point */}
        <path
          d={`M ${cx} ${size * 0.14} L ${cx - size * 0.055} ${cx} L ${cx + size * 0.055} ${cx} Z`}
          fill="#b8935a"
        />
        {/* south (parchment) tail */}
        <path
          d={`M ${cx} ${size - size * 0.14} L ${cx - size * 0.055} ${cx} L ${cx + size * 0.055} ${cx} Z`}
          fill="rgba(243,239,230,0.55)"
        />
      </g>

      {/* Center hub */}
      <circle cx={cx} cy={cx} r={size * 0.16} fill="#0a0908" stroke="rgba(184,147,90,0.35)" strokeWidth={1.5} />

      {/* Mono complications inside the face */}
      {dayLabel && (
        <text
          x={cx}
          y={cx - size * 0.045}
          textAnchor="middle"
          fill="rgba(243,239,230,0.55)"
          fontFamily="var(--font-jetbrains-mono), monospace"
          fontSize={size * 0.07}
        >
          {dayLabel}
        </text>
      )}
      {primary && (
        <text
          x={cx}
          y={cx + size * 0.09}
          textAnchor="middle"
          fill="#b8935a"
          fontFamily="var(--font-jetbrains-mono), monospace"
          fontWeight={700}
          fontSize={size * 0.11}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {primary}
        </text>
      )}
      {ringLabel && (
        <text
          x={cx}
          y={cx + size * 0.16}
          textAnchor="middle"
          fill="rgba(243,239,230,0.5)"
          fontFamily="var(--font-jetbrains-mono), monospace"
          fontSize={size * 0.05}
          letterSpacing="0.08em"
        >
          {ringLabel}
        </text>
      )}
    </svg>
  )

  if (!onClick) {
    return <div className={className}>{content}</div>
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={interactiveLabel}
      className={`inline-flex cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-gold ${className}`}
    >
      {content}
    </button>
  )
}
