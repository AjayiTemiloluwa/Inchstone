'use client'

import { format } from 'date-fns'
import { Panel, PageHeader } from '@/components/ds'
import { InlineEdit } from '@/components/ui/InlineEdit'
import { Breadcrumbs, type Crumb } from './Breadcrumbs'
import { DeleteItemButton } from './DeleteItemButton'
import { ScoreInstrument } from './primitives'
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
  /** Mono kicker, e.g. "Quarter"; the date range is appended when showTheme. */
  eyebrow?: string
  /** Path back up the hierarchy, shown above the header. */
  crumbs?: Crumb[]
  onRename: (title: string) => void
  onTheme?: (theme: string) => void
  onDeleted: (id: string) => void | Promise<void>
}

const editInput = 'w-full min-w-0 rounded-lg border border-gold/40 bg-ink/40 px-2 py-1 text-parchment outline-none focus:ring-2 focus:ring-gold/30'

/** Header for a single item (goal / quarter / month): crumbs, editable title + theme, delete, work-clock read. */
export function ItemHeaderCard({
  item, score, fallbackTitle, renameLabel, deleteLabel, showTheme = false, eyebrow, crumbs, onRename, onTheme, onDeleted,
}: ItemHeaderCardProps) {
  const range = showTheme && (item.startDate || item.endDate)
    ? `${item.startDate ? format(new Date(item.startDate), 'MMM d') : ''} – ${item.endDate ? format(new Date(item.endDate), 'MMM d, yyyy') : ''}`
    : null
  const kicker = [eyebrow, range].filter(Boolean).join(' · ') || undefined

  return (
    <div className="space-y-5 sm:space-y-6">
      {crumbs && <Breadcrumbs crumbs={crumbs} />}
      <PageHeader
        eyebrow={kicker}
        title={
          <InlineEdit value={item.title || fallbackTitle || ''} onSave={onRename} title={renameLabel}
            inputClassName={`${editInput} text-h1`} />
        }
        description={showTheme ? (
          <span className="font-display italic text-gold">
            <InlineEdit value={item.theme || ''} onSave={t => onTheme?.(t)} placeholder="Add a theme quote..." title="Edit theme quote"
              inputClassName={`${editInput} text-body font-display italic`} />
          </span>
        ) : undefined}
        actions={<DeleteItemButton itemId={item.id} title={deleteLabel} onDeleted={onDeleted} />}
      />
      <Panel>
        <ScoreInstrument score={score} label="Progress" />
      </Panel>
    </div>
  )
}
