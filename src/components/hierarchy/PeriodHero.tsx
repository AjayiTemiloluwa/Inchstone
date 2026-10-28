'use client'

import { Download } from 'lucide-react'
import { ProgressRing } from '@/components/ui/ProgressRing'

interface PeriodHeroProps {
  title: string
  subtitle: string
  score: number
  onDownloadReport: () => void
}

/** Gold glass header for the aggregated quarter / month / week pages. */
export function PeriodHero({ title, subtitle, score, onDownloadReport }: PeriodHeroProps) {
  return (
    <div className="glass-gold rounded-[8px] p-4 sm:p-8 animate-slideUp border border-gold/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-3xl sm:text-4xl font-display font-bold bg-gradient-to-r from-gold to-gold-glow bg-clip-text text-transparent">{title}</h1>
          <p className="text-sm text-ink/70 mt-2 font-mono">{subtitle}</p>
        </div>
        <div className="flex items-center space-x-4 sm:space-x-6">
          <button type="button" onClick={onDownloadReport} aria-label="Download report"
            className="px-4 py-2.5 min-h-[40px] bg-black/20 text-gold border border-gold/30 text-sm font-bold rounded-xl hover:bg-gold/10 transition-all flex items-center space-x-2">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Report</span>
          </button>
          <ProgressRing progress={score} size={72} />
        </div>
      </div>
    </div>
  )
}
