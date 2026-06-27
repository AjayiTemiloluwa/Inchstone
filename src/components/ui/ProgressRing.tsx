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
  trackColorClass = 'text-mist'
}: ProgressRingProps) {
  const safeProgress = Math.min(100, Math.max(0, progress))
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDashoffset = circumference - (safeProgress / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          className={trackColorClass}
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={`${colorClass} transition-all duration-500 ease-out`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute flex items-center justify-center text-xs font-mono font-medium">
        {Math.round(safeProgress)}%
      </div>
    </div>
  )
}
