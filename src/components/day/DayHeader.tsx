'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { differenceInDays, endOfYear, format, isToday, startOfYear } from 'date-fns'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ProgressRing } from '@/components/ui/ProgressRing'

const navBtn =
  'w-10 h-10 flex items-center justify-center rounded-full bg-black/20 border border-white/10 text-ink/60 hover:text-gold hover:border-gold/40 hover:bg-gold/10 active:scale-95 transition-all shrink-0'

const fmt = (n: number) => String(Math.round(n * 10) / 10)

export function DayHeader({
  currentDate,
  completed,
  earnedPoints,
  totalPoints,
  total,
  dayScore,
  onPrev,
  onNext,
  onToday,
}: {
  currentDate: Date
  completed: number
  earnedPoints: number
  totalPoints: number
  total: number
  dayScore: number
  onPrev: () => void
  onNext: () => void
  onToday?: () => void
}) {
  const today = isToday(currentDate)
  const dayOfYear = differenceInDays(currentDate, startOfYear(currentDate)) + 1
  const daysInYear = differenceInDays(endOfYear(currentDate), startOfYear(currentDate)) + 1

  return (
    <div className="glass-gold rounded-2xl p-5 sm:p-6 animate-slideUp border border-gold/20">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 sm:gap-4">
          <button onClick={onPrev} aria-label="Previous day" className={navBtn}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-3xl sm:text-4xl font-display font-bold bg-gradient-to-r from-gold to-gold-glow bg-clip-text text-transparent">
                {format(currentDate, 'EEEE')}
              </h1>
              {today ? (
                <span className="rounded-full bg-gold/20 border border-gold/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">Today</span>
              ) : (
                onToday && (
                  <button
                    onClick={onToday}
                    className="rounded-full border border-white/10 bg-black/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink/60 hover:border-gold/40 hover:text-gold transition"
                  >
                    Back to today
                  </button>
                )
              )}
            </div>
            <p className="mt-0.5 text-sm sm:text-base text-ink/70 font-mono">
              {format(currentDate, 'MMMM d, yyyy')}
              <span className="ml-2 text-[11px] text-ink/40">Day {dayOfYear}/{daysInYear}</span>
            </p>
          </div>
          <button onClick={onNext} aria-label="Next day" className={navBtn}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          <div className="text-right">
            <p className="text-[10px] text-ink/50 uppercase font-bold tracking-wider">Points</p>
            <p className="text-xl font-mono font-bold tabular-nums">{fmt(earnedPoints)}<span className="text-ink/40">/{fmt(totalPoints)}</span></p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-ink/50 uppercase font-bold tracking-wider">Tasks</p>
            <p className="text-xl font-mono font-bold tabular-nums">{completed}<span className="text-ink/40">/{total}</span></p>
          </div>
          <ProgressRing progress={dayScore} size={56} />
        </div>
      </div>
      <div className="mt-4">
        <ProgressBar progress={dayScore} colorClass={dayScore >= 80 ? 'bg-sage' : dayScore >= 40 ? 'bg-gold' : 'bg-ember'} />
      </div>
    </div>
  )
}
