'use client'

import { format } from 'date-fns'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { InlineEdit } from '@/components/ui/InlineEdit'
import { DeleteItemButton } from './DeleteItemButton'
import type { Item } from '@/stores/hierarchyStore'

interface ItemHeaderCardProps {
  item: Item
  score: number
  /** Fallback shown when the item has no title. */
  fallbackTitle?: string
  renameLabel: string
  deleteLabel: string
  /** Show the editable theme quote and date range (goal / quarter). */
  showTheme?: boolean
  onRename: (title: string) => void
  onTheme?: (theme: string) => void
  onDeleted: (id: string) => void | Promise<void>
}

export function ItemHeaderCard({
  item, score, fallbackTitle, renameLabel, deleteLabel, showTheme = false, onRename, onTheme, onDeleted,
}: ItemHeaderCardProps) {
  return (
    <div className="bg-surface border border-mist rounded-[8px] p-4 pr-14 sm:p-8 relative">
      <DeleteItemButton itemId={item.id} title={deleteLabel} variant="header" onDeleted={onDeleted} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-ink">
            <InlineEdit value={item.title || fallbackTitle || ''} onSave={onRename} title={renameLabel}
              inputClassName="w-full min-w-0 rounded-md border border-gold/40 bg-mist/20 px-2 py-1 text-3xl font-display font-bold text-ink outline-none focus:ring-2 focus:ring-gold/30" />
          </h1>
          {showTheme && (
            <>
              <p className="text-gold font-serif italic mt-1">
                <InlineEdit value={item.theme || ''} onSave={t => onTheme?.(t)} placeholder="Add a theme quote..." title="Edit theme quote"
                  inputClassName="w-full min-w-0 rounded-md border border-gold/40 bg-mist/20 px-2 py-1 text-base font-serif italic text-gold outline-none focus:ring-2 focus:ring-gold/30" />
              </p>
              <p className="text-sm text-ink/50 mt-2 font-mono">
                {item.startDate && format(new Date(item.startDate), 'MMM d')} – {item.endDate && format(new Date(item.endDate), 'MMM d, yyyy')}
              </p>
            </>
          )}
        </div>
        <ProgressRing progress={score} size={72} />
      </div>
    </div>
  )
}
