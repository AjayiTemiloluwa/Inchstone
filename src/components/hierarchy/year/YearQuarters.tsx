'use client'

import { useRouter } from 'next/navigation'
import { Section } from '@/components/ds'
import { Reveal } from '@/components/ui/motion'
import type { Item } from '@/stores/hierarchyStore'
import { PeriodGrid, PeriodTile } from '../primitives'

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

/** Four quarters, each averaging every matching quarter objective. 4-up on desktop, rows on phones. */
export function YearQuarters({ quarters, completionMap }: YearQuartersProps) {
  const router = useRouter()
  return (
    <Section title="Quarters" id="year-quarters">
      <PeriodGrid cols={4}>
        {QUARTERS.map(({ label, range }, qi) => {
          const qItems = quarters.filter(q => q.title.includes(label))
          const avg = qItems.length > 0 ? qItems.reduce((s, q) => s + (completionMap[q.id] || 0), 0) / qItems.length : 0
          const enabled = qItems.length > 0
          return (
            // Spec D4: total stagger capped at 200ms.
            <Reveal key={label} delay={qi * 50}>
              <PeriodTile label={label} sublabel={range} score={avg} caption={`${qItems.length} goals`}
                onOpen={() => { if (enabled) router.push(`/year/${label}`) }} disabled={!enabled} />
            </Reveal>
          )
        })}
      </PeriodGrid>
    </Section>
  )
}
