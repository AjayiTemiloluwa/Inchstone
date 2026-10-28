'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { differenceInDays, endOfYear, format, startOfYear } from 'date-fns'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ProgressRing } from '@/components/ui/ProgressRing'

export function DayHeader({
  currentDate,
  completed,
  total,
  dayScore,
  onPrev,
  onNext,
}: {
  currentDate: Date
  completed: number
  total: number
  dayScore: number
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div className="glass-gold rounded-[8px] p-5 sm:p-6 animate-slideUp border border-gold/20">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={onPrev}
            aria-label="Previous day"
            className="w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-black/20 border border-white/10 text-ink/50 hover:text-gold hover:border-gold/40 transition shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-left">
            <h1 className="text-3xl sm:text-4xl font-display font-bold bg-gradient-to-r from-gold to-gold-glow bg-clip-text text-transparent">{format(currentDate, 'EEEE')}</h1>
            <p className="text-sm sm:text-base text-ink/70 mt-0.5 font-mono">{format(currentDate, 'MMMM d, yyyy')}</p>
            <p className="text-[10px] text-ink/40 mt-0.5 font-mono">Day {differenceInDays(currentDate, startOfYear(currentDate)) + 1} of {differenceInDays(endOfYear(currentDate), startOfYear(currentDate)) + 1}</p>
          </div>
          <button
            onClick={onNext}
            aria-label="Next day"
            className="w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-black/20 border border-white/10 text-ink/50 hover:text-gold hover:border-gold/40 transition shrink-0"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="text-right">
            <p className="text-[11px] text-ink/50 uppercase font-bold tracking-wider">Tasks</p>
            <p className="text-xl font-mono font-bold">{completed}/{total}</p>
          </div>
          <ProgressRing progress={dayScore} size={56} />
        </div>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-xs text-ink/50 mb-1">
          <span>Day Progress</span>
          <span className="font-mono font-bold">{Math.round(dayScore)}%</span>
        </div>
        <ProgressBar progress={dayScore} colorClass={dayScore >= 80 ? 'bg-sage' : dayScore >= 40 ? 'bg-gold' : 'bg-ember'} />
      </div>
    </div>
  )
}
