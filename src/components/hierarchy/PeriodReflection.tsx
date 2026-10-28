'use client'

import { BookOpen } from 'lucide-react'
import { Card } from '@/components/ui/Card'
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
 * Inline reflection card for the aggregated period pages. Render with
 * `key={itemId}` so the draft reseeds when the item first resolves.
 */
export function PeriodReflection({ label, timePeriod, itemId, initialText, periodKey, placeholder }: PeriodReflectionProps) {
  const { text, change } = useReflectionDraft(itemId, initialText)
  return (
    <div>
      <div className="flex items-center space-x-2 mb-4">
        <BookOpen className="w-5 h-5 text-gold" />
        <h2 className="text-2xl font-display font-bold text-ink">{label} Reflection</h2>
      </div>
      <Card className="p-4 sm:p-6 space-y-3">
        <ReflectionPicker timePeriod={timePeriod} periodKey={periodKey} itemId={itemId} onSelect={change} className="mb-2" />
        <textarea value={text} onChange={e => change(e.target.value)} placeholder={placeholder}
          className="w-full h-48 bg-black/20 border border-white/10 rounded-xl p-4 sm:p-5 text-sm text-ink resize-none focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/30 placeholder:text-ink/30 transition-all" />
        <p className="text-[10px] text-ink/40 mt-2">Auto-saves as you type — pick a saved template above to quick-fill.</p>
      </Card>
    </div>
  )
}
