interface ProgressBarProps {
  progress: number // 0 to 100
  colorClass?: string
  className?: string
  showLabel?: boolean
}

export function ProgressBar({ progress, colorClass = 'bg-gold', className = '', showLabel = false }: ProgressBarProps) {
  const safeProgress = Math.min(100, Math.max(0, progress))
  
  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between mb-1 text-xs font-mono text-ink/70">
          <span>Progress</span>
          <span>{Math.round(safeProgress)}%</span>
        </div>
      )}
      <div className="w-full h-2 bg-mist rounded-full overflow-hidden">
        <div 
          className={`h-full ${colorClass} transition-all duration-500 ease-out`} 
          style={{ width: `${safeProgress}%` }}
        />
      </div>
    </div>
  )
}
