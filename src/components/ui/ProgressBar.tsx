interface ProgressBarProps {
  progress: number // 0 to 100
  colorClass?: string
  className?: string
  showLabel?: boolean
}

export function ProgressBar({ progress, colorClass = 'bg-gold', className = '', showLabel = false }: ProgressBarProps) {
  const safeProgress = Math.min(100, Math.max(0, progress))

  // Determine glow color based on the bar color
  const glowColor = colorClass.includes('sage')
    ? 'rgba(123,160,91,0.4)'
    : colorClass.includes('coral')
      ? 'rgba(232,104,106,0.4)'
      : 'rgba(212,175,55,0.4)'

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between mb-1.5 text-xs font-mono text-ink/50">
          <span>Progress</span>
          <span className="font-bold text-ink/70">{Math.round(safeProgress)}%</span>
        </div>
      )}
      <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${colorClass} animate-progressFill relative`}
          style={{
            width: `${safeProgress}%`,
            transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
            boxShadow: safeProgress > 0 ? `0 0 12px ${glowColor}` : 'none',
          }}
        >
          {/* Shimmer overlay on the filled portion */}
          {safeProgress > 10 && (
            <div
              className="absolute inset-0 rounded-full animate-shimmer"
              style={{ background: 'linear-gradient(90deg, transparent 30%, rgba(255,255,255,0.15) 50%, transparent 70%)', backgroundSize: '200% 100%' }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
