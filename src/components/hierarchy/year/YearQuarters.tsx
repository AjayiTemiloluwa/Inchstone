'use client'

import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { Reveal, Scramble } from '@/components/ui/motion'
import type { Item } from '@/stores/hierarchyStore'

const QUARTERS = [
  { label: 'Q1', range: 'Jan–Mar' },
  { label: 'Q2', range: 'Apr–Jun' },
  { label: 'Q3', range: 'Jul–Sep' },
  { label: 'Q4', range: 'Oct–Dec' },
]

interface YearQuartersProps {
  quarters: Item[]
  completionMap: Record<string, number>
}

/** Four quarter cards, each averaging every matching quarter objective. */
export function YearQuarters({ quarters, completionMap }: YearQuartersProps) {
  const router = useRouter()
  return (
    <div>
      <h2 className="text-2xl sm:text-3xl font-display font-bold text-ink mb-4 sm:mb-6"><Scramble text="Quarters" mono={false} /></h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {QUARTERS.map(({ label, range }, qi) => {
          const qItems = quarters.filter(q => q.title.includes(label))
          const avg = qItems.length > 0 ? qItems.reduce((s, q) => s + (completionMap[q.id] || 0), 0) / qItems.length : 0
          const enabled = qItems.length > 0
          return (
            <Reveal key={label} delay={qi * 90}>
              <Card className={`p-5 transition-colors group ${enabled ? 'hover:border-gold cursor-pointer active:opacity-70' : 'opacity-50 cursor-not-allowed'}`}
                onClick={() => { if (enabled) router.push(`/year/${label}`) }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-widest bg-gradient-to-r from-gold to-gold-glow bg-clip-text text-transparent">{label}</p>
                    <p className="text-[10px] text-ink/40 mt-0.5">{range}</p>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <ProgressRing progress={avg} size={48} />
                  <div className="text-right">
                    <p className="text-xl font-mono font-bold">{Math.round(avg)}%</p>
                    <p className="text-[10px] text-ink/40">{qItems.length} goals</p>
                  </div>
                </div>
              </Card>
            </Reveal>
          )
        })}
      </div>
    </div>
  )
}
