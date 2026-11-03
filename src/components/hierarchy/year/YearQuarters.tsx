'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, X } from 'lucide-react'
import { Button, IconButton, Section } from '@/components/ds'
import { Reveal } from '@/components/ui/motion'
import type { Item } from '@/stores/hierarchyStore'
import { PeriodGrid, PeriodTile } from '../primitives'
import { ItemEditDialog } from '../ItemEditDialog'
import { useDialog } from '@/components/ui/useDialog'

const QUARTERS = [
  { label: 'Q1', range: 'Jan–Mar' },
  { label: 'Q2', range: 'Apr–Jun' },
  { label: 'Q3', range: 'Jul–Sep' },
  { label: 'Q4', range: 'Oct–Dec' },
]

interface YearQuartersProps {
  quarters: Item[]
  completionMap: Record<string, number>
  /** Reload the item tree after an edit. */
  onSaved?: () => unknown
}

/** Four quarters, each averaging every matching quarter objective. 4-up on desktop, rows on phones. */
export function YearQuarters({ quarters, completionMap, onSaved }: YearQuartersProps) {
  const router = useRouter()
  const [choosing, setChoosing] = useState<string | null>(null) // a quarter label whose objectives are being listed
  const [editing, setEditing] = useState<Item | null>(null)
  const pickRef = useDialog<HTMLDivElement>(choosing !== null, () => setChoosing(null))
  const startEdit = (label: string) => {
    const items = quarters.filter(q => q.title.includes(label))
    if (items.length === 1) setEditing(items[0])
    else if (items.length > 1) setChoosing(label)
  }
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
              <div className="space-y-2">
                <PeriodTile label={label} sublabel={range} score={avg} caption={`${qItems.length} goals`}
                  onOpen={() => { if (enabled) router.push(`/year/${label}`) }} disabled={!enabled} />
                <Button variant="ghost" icon={Pencil} className="w-full" disabled={!enabled} onClick={() => startEdit(label)}
                  aria-label={`Edit ${label} details`}>Edit {label}</Button>
              </div>
            </Reveal>
          )
        })}
      </PeriodGrid>

      {choosing && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fadeIn sm:items-center" onClick={() => setChoosing(null)}>
          <div ref={pickRef} role="dialog" aria-modal="true" aria-label={`Edit ${choosing}`} tabIndex={-1} onClick={e => e.stopPropagation()}
            className="max-h-[80dvh] w-full overflow-y-auto rounded-t-2xl border border-gold-dim/25 bg-surface-solid p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] animate-slideUp sm:max-w-md sm:rounded-[8px]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-display text-lg font-bold text-parchment">Which {choosing} goal?</h3>
              <IconButton icon={X} label="Close" onClick={() => setChoosing(null)} />
            </div>
            <ul className="space-y-2">
              {quarters.filter(q => q.title.includes(choosing)).map(q => (
                <li key={q.id}>
                  <button type="button" onClick={() => { setEditing(q); setChoosing(null) }}
                    className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-gold/20 px-3 py-2 text-left text-sm text-parchment hover:border-gold/50">
                    <span className="min-w-0 break-words">{q.title}</span>
                    <Pencil className="h-4 w-4 shrink-0 text-gold-dim" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {editing && (
        <ItemEditDialog item={editing} heading={editing.title} fields={['title', 'description', 'theme', 'focusQuestion', 'anchorScripture', 'dates']}
          onClose={() => setEditing(null)} onSaved={onSaved} />
      )}
    </Section>
  )
}
