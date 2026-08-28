'use client'

/**
 * HabitSparkline — a whisper-thin line graph of a habit's day-by-day history.
 *
 * Drawn inline inside the existing habit row (fixed 64×20 on mobile, 96×20 on
 * sm+), so the box never grows. Done days ride high with a gold node; missed
 * days sit low — the line reads like a rhythm of the last 30 days.
 */
export function HabitSparkline({
  values,
  width = 64,
  height = 20,
  className = '',
}: {
  values: boolean[]
  width?: number
  height?: number
  className?: string
}) {
  const n = values.length
  if (n === 0) return null

  const stepX = n > 1 ? width / (n - 1) : 0
  const yDone = 3.5
  const yMissed = height - 4.5
  const points = values
    .map((v, i) => `${(i * stepX).toFixed(1)},${(v ? yDone : yMissed).toFixed(1)}`)
    .join(' ')

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`shrink-0 text-gold-dim ${className}`}
      aria-hidden="true"
    >
      {/* baseline whisper */}
      <line x1="0" y1={yMissed} x2={width} y2={yMissed} stroke="currentColor" strokeWidth="1" opacity="0.25" />
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
      {values.map((v, i) =>
        v ? (
          <circle key={i} cx={i * stepX} cy={yDone} r="1.7" className="fill-gold" stroke="none" />
        ) : null,
      )}
    </svg>
  )
}