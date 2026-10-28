'use client'

import { motion } from 'motion/react'
import { Calendar, Repeat, Trash2, X } from 'lucide-react'
import { useDialog } from '@/components/ui/useDialog'
import { BACKDROP_CLASS, SHEET_SAFE_AREA, type DeleteScope } from './types'

export type DeleteScopeTarget = { taskId: string; title: string; isHabit: boolean }

/**
 * Delete-scope prompt — repeating deeds and habits can be removed as one
 * occurrence, as this occurrence plus every later one, or as the whole series.
 * Mount inside <AnimatePresence> only while a target is set.
 */
export function DeleteScopeDialog({
  target,
  onDelete,
  onClose,
}: {
  target: DeleteScopeTarget
  onDelete: (scope: DeleteScope) => void
  onClose: () => void
}) {
  const panelRef = useDialog<HTMLDivElement>(true, onClose)
  return (
    <motion.div
      className={BACKDROP_CLASS}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Delete repeating deed"
        tabIndex={-1}
        data-lenis-prevent
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className={`max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-gold-dim/25 bg-surface-solid outline-none sm:max-w-md sm:rounded-[8px] ${SHEET_SAFE_AREA}`}
        onClick={e => e.stopPropagation()}
      >
              <div className="border-b border-white/10 px-6 py-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gold">
                  {target.isHabit ? 'Delete habit' : 'Delete repeating deed'}
                </p>
                <h3 className="mt-1 truncate font-display text-lg font-bold text-ink">{target.title}</h3>
                <p className="mt-1 text-xs text-ink/50">This one repeats. How much should go?</p>
              </div>

              <div className="space-y-1.5 px-4 py-4">
                <button
                  onClick={() => onDelete('single')}
                  className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.06]"
                >
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-ink/40" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">
                      {target.isHabit ? 'Just today' : 'Just this one'}
                    </span>
                    <span className="block text-[11px] text-ink/45">
                      {target.isHabit
                        ? 'Skips today only — the habit is back tomorrow.'
                        : 'Skips this occurrence only — the series carries on.'}
                    </span>
                  </span>
                </button>

                <button
                  onClick={() => onDelete('future')}
                  className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.06]"
                >
                  <Repeat className="mt-0.5 h-4 w-4 shrink-0 text-ink/40" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">This and all future</span>
                    <span className="block text-[11px] text-ink/45">
                      Stops everything from this day forward; earlier days are kept.
                    </span>
                  </span>
                </button>

                <button
                  onClick={() => onDelete('all')}
                  className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-ember/10"
                >
                  <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-[#cf8f78]" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[#cf8f78]">The entire series</span>
                    <span className="block text-[11px] text-ink/45">
                      {target.isHabit
                        ? 'Every instance, past and future — this erases the history too.'
                        : 'Every occurrence, past and future.'}
                    </span>
                  </span>
                </button>
              </div>

              <div className="flex justify-end border-t border-white/10 bg-black/20 px-6 py-3">
                <button
                  onClick={onClose}
                  className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-ink/60 transition hover:bg-white/5 hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Cancel</span>
                </button>
              </div>

      </motion.div>
    </motion.div>
  )
}
