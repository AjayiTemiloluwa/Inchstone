'use client'

import { BookOpen, X } from 'lucide-react'
import { IconButton } from '@/components/ds'
import { useDialog } from '@/components/ui/useDialog'
import { ReflectionPicker } from '@/components/ui/ReflectionPicker'
import { useReflectionDraft } from './useReflectionDraft'
import type { Item } from '@/stores/hierarchyStore'

interface ReflectionPopupProps {
  item: Item
  timePeriod: 'week' | 'month' | 'quarter' | 'year'
  periodKey: string
  /** Hide the saved-template picker (goal pages have none). */
  withPicker?: boolean
  onClose: () => void
}

/**
 * Reflection editor in a modal (bottom sheet on phones, spec D7). Mount it only
 * while open so the draft is seeded from the item's saved reflection.
 */
export function ReflectionPopup({ item, timePeriod, periodKey, withPicker = true, onClose }: ReflectionPopupProps) {
  const ref = useDialog<HTMLDivElement>(true, onClose)
  const { text, change } = useReflectionDraft(item.id, item.reflection)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 sm:items-center sm:p-4" onClick={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label="Reflection" tabIndex={-1} data-lenis-prevent
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-xl border border-gold/15 bg-surface-solid p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-xl sm:p-6"
        onClick={e => e.stopPropagation()}>
        <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-full bg-parchment/15 sm:hidden" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-gold-dim" strokeWidth={1.75} aria-hidden="true" />
            <h3 className="text-heading text-parchment">Reflection</h3>
          </div>
          <IconButton icon={X} label="Close reflection" onClick={onClose} />
        </div>
        {withPicker && (
          <ReflectionPicker timePeriod={timePeriod} periodKey={periodKey} itemId={item.id} onSelect={change} className="mb-3" />
        )}
        <textarea value={text} onChange={e => change(e.target.value)} placeholder="Write your reflection..."
          className="h-32 w-full resize-none rounded-lg border border-gold/20 bg-ink/40 p-3 text-body text-parchment placeholder:text-parchment/30 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/20" />
        <p className="mt-2 text-caption text-parchment/45">
          {withPicker ? 'Auto-saves as you type — pick a saved template above to quick-fill.' : 'Auto-saves as you type'}
        </p>
      </div>
    </div>
  )
}
