'use client'

import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { IconButton } from '@/components/ds'
import { useDialog } from '@/components/ui/useDialog'

/** Bottom sheet on phones, centred dialog from `sm` up. Escape / backdrop closes; focus is trapped. */
export function FinanceSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useDialog<HTMLDivElement>(open, onClose)
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fadeIn sm:items-center" onClick={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onClick={(e) => e.stopPropagation()} data-lenis-prevent
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-gold-dim/25 bg-surface-solid outline-none animate-slideUp sm:max-w-lg sm:rounded-[8px]">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <h2 className="font-display text-lg font-bold text-parchment">{title}</h2>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
