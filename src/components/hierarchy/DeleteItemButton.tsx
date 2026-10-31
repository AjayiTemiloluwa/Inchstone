'use client'

import type { MouseEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { IconButton } from '@/components/ds'
import { useToast } from '@/components/ui/ToastProvider'

const DEFAULT_MESSAGE = 'Are you sure you want to delete this? All nested goals will also be deleted.'

interface DeleteOptions {
  itemId: string
  confirmMessage?: string
  /** Called after a successful delete. */
  onDeleted: (id: string) => void | Promise<void>
}

/**
 * Confirm, DELETE /api/items/:id, then hand back to the caller. Shared by the
 * icon button below and by `<RowActions>` menus ("Delete …" entries).
 */
export function useDeleteItem({ itemId, confirmMessage = DEFAULT_MESSAGE, onDeleted }: DeleteOptions) {
  const { showToast, confirm } = useToast()
  return async () => {
    if (!(await confirm(confirmMessage))) return
    try {
      const res = await fetch(`/api/items/${itemId}`, { method: 'DELETE' })
      if (!res.ok) { showToast('Failed to delete item', 'error'); return }
      await onDeleted(itemId)
      showToast('Item deleted', 'success')
    } catch (err) {
      console.error(err)
      showToast('Failed to delete item', 'error')
    }
  }
}

interface DeleteItemButtonProps extends DeleteOptions {
  title: string
  className?: string
}

/** Ember-on-hover trash icon; clicks never bubble to a surrounding card. */
export function DeleteItemButton({ itemId, title, confirmMessage, onDeleted, className }: DeleteItemButtonProps) {
  const remove = useDeleteItem({ itemId, confirmMessage, onDeleted })
  const handle = (e: MouseEvent) => {
    e.stopPropagation()
    void remove()
  }
  return <IconButton icon={Trash2} label={title} tone="danger" onClick={handle} className={className} />
}
