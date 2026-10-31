'use client'

import { Panel, Section } from '@/components/ds'
import { ReflectionPicker } from '@/components/ui/ReflectionPicker'
import { useReflectionDraft } from './useReflectionDraft'

interface PeriodReflectionProps {
  label: string
  timePeriod: 'week' | 'month' | 'quarter' | 'year'
  /** The item the reflection is stored on (first matching period item). */
  itemId: string | null
  /** Saved reflection on that item, used to seed the draft. */
  initialText: string | null | undefined
  periodKey: string
  placeholder: string
}

/**
 * Inline reflection section for the aggregated period pages. Render with
 * `key={itemId}` so the draft reseeds when the item first resolves.
 */
export function PeriodReflection({ label, timePeriod, itemId, initialText, periodKey, placeholder }: PeriodReflectionProps) {
  const { text, change } = useReflectionDraft(itemId, initialText)
  return (
    <Section title={`${label} reflection`} description="Auto-saves as you type. Pick a saved template to quick-fill.">
      <Panel className="space-y-4">
        <ReflectionPicker timePeriod={timePeriod} periodKey={periodKey} itemId={itemId} onSelect={change} />
        <textarea value={text} onChange={e => change(e.target.value)} placeholder={placeholder} aria-label={`${label} reflection`}
          className="h-48 w-full resize-none rounded-lg border border-gold/20 bg-ink/40 p-4 text-body text-parchment placeholder:text-parchment/30 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/20" />
      </Panel>
    </Section>
  )
}
