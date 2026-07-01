interface ProgressRingProps {
  progress: number
  size?: number
  strokeWidth?: number
  colorClass?: string
  trackColorClass?: string
}

export function ProgressRing({
  progress,
  size = 40,
  strokeWidth = 4,
  colorClass = 'text-gold',
  trackColorClass = 'text-white/10'
}: ProgressRingProps) {
  const safeProgress = Math.min(100, Math.max(0, progress))
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDashoffset = circumference - (safeProgress / 100) * circumference

  // Determine glow filter based on color
  const glowFilter = colorClass.includes('sage')
    ? 'drop-shadow(0 0 6px rgba(123,160,91,0.5))'
    : colorClass.includes('coral')
      ? 'drop-shadow(0 0 6px rgba(232,104,106,0.5))'
      : 'drop-shadow(0 0 6px rgba(212,175,55,0.5))'

  // Dynamic color based on progress
  const progressColor = safeProgress >= 80 ? '#7BA05B' : safeProgress >= 40 ? '#D4AF37' : '#E8686A'
  const useAutoColor = colorClass === 'text-gold' // Only auto-color when using default

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        className="transform -rotate-90"
        width={size}
        height={size}
        style={{ filter: safeProgress > 0 ? glowFilter : 'none' }}
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
      <div className="absolute flex items-center justify-center text-xs font-mono font-bold"
        style={{ fontSize: size < 48 ? '9px' : '11px' }}>
        {Math.round(safeProgress)}
        <span className="text-ink/30" style={{ fontSize: size < 48 ? '7px' : '9px' }}>%</span>
      </div>
    </div>
  )
}
