'use client'

import type { MouseEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'

interface DeleteItemButtonProps {
  itemId: string
  title: string
  /** 'header' = big corner button, 'card' = corner chip on a card, 'inline' = static icon button. */
  variant?: 'header' | 'card' | 'inline'
  confirmMessage?: string
  /** Called after a successful delete. */
  onDeleted: (id: string) => void | Promise<void>
}

const DEFAULT_MESSAGE = 'Are you sure you want to delete this? All nested goals will also be deleted.'

const STYLES = {
  header: 'absolute top-4 right-4 p-2.5 text-ink/30 hover:text-[#cf8f78] hover:bg-ember/15 rounded-lg transition',
  inline: 'p-1.5 hover:bg-ember/15 rounded-lg transition text-ink/30 hover:text-[#cf8f78] min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0',
  card: 'absolute top-2 right-2 p-2 sm:p-1.5 bg-paper/80 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 hover:bg-ember/15 rounded-lg transition text-ink/30 hover:text-[#cf8f78] z-10',
}

export function DeleteItemButton({ itemId, title, variant = 'card', confirmMessage = DEFAULT_MESSAGE, onDeleted }: DeleteItemButtonProps) {
  const { showToast, confirm } = useToast()

  const handle = async (e: MouseEvent) => {
    e.stopPropagation()
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

  return (
    <button type="button" onClick={handle} className={STYLES[variant]} title={title} aria-label={title}>
      <Trash2 className={variant === 'header' ? 'w-5 h-5' : 'w-4 h-4'} />
    </button>
  )
}
