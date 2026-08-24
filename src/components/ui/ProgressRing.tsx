interface ProgressRingProps {
  progress: number
  size?: number
  strokeWidth?: number
  colorClass?: string
  trackColorClass?: string
  className?: string
}

export function ProgressRing({
  progress,
  size = 40,
  strokeWidth = 4,
  colorClass = 'text-gold',
  trackColorClass = 'text-white/10',
  className = ''
}: ProgressRingProps) {
  const safeProgress = Math.min(100, Math.max(0, progress))
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDashoffset = circumference - (safeProgress / 100) * circumference

  // Quiet token palette — no glows (v2 F2). Completed rollups → readable moss,
  // most progress → gold, low → readable ember. Explicit colorClass wins.
  const progressColor =
    safeProgress >= 100 ? '#7fa871'
    : safeProgress >= 40 ? '#b8935a'
    : '#cf8a68'
  const useAutoColor = colorClass === 'text-gold'

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg
        className="transform -rotate-90"
        width={size}
        height={size}
      >
        {/* Track */}
        <circle
          className={trackColorClass}
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Fill */}
        <circle
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          stroke={useAutoColor ? progressColor : 'currentColor'}
          className={useAutoColor ? '' : colorClass}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          style={{
            transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1), stroke 0.5s ease',
            '--circumference': `${circumference}`,
          } as React.CSSProperties}
        />
      </svg>
      <div className="absolute flex items-center justify-center font-mono font-bold"
        style={{ fontSize: size < 48 ? '9px' : '11px' }}>
        {Math.round(safeProgress)}
        <span style={{ fontSize: size < 48 ? '7px' : '9px', color: 'rgba(243,239,230,0.35)' }}>%</span>
      </div>
    </div>
  )
}
