'use client'

import { BookOpen, X } from 'lucide-react'
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
 * Reflection editor in a modal (bottom sheet on phones). Mount it only while
 * open so the draft is seeded from the item's saved reflection.
 */
export function ReflectionPopup({ item, timePeriod, periodKey, withPicker = true, onClose }: ReflectionPopupProps) {
  const ref = useDialog<HTMLDivElement>(true, onClose)
  const { text, change } = useReflectionDraft(item.id, item.reflection)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/20 sm:p-4" onClick={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label="Reflection" tabIndex={-1} data-lenis-prevent
        className="bg-surface border border-mist p-5 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[92dvh] overflow-y-auto pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2"><BookOpen className="w-4 h-4 text-gold" /><h3 className="font-bold text-ink text-sm">Reflection</h3></div>
          <button type="button" onClick={onClose} aria-label="Close reflection" className="p-2 hover:bg-mist rounded-lg transition text-ink/30 hover:text-ink"><X className="w-4 h-4" /></button>
        </div>
        {withPicker && (
          <ReflectionPicker timePeriod={timePeriod} periodKey={periodKey} itemId={item.id} onSelect={change} className="mb-3" />
        )}
        <textarea value={text} onChange={e => change(e.target.value)} placeholder="Write your reflection..."
          className="w-full h-32 bg-paper border border-mist rounded-lg p-3 text-sm text-ink resize-none focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-ink/30" />
        <p className="text-[10px] text-ink/40 mt-1">
          {withPicker ? 'Auto-saves as you type — pick a saved template above to quick-fill.' : 'Auto-saves as you type'}
        </p>
      </div>
    </div>
  )
}
