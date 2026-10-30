'use client'

import { motion } from 'motion/react'
import { Calendar, Layers, Repeat, X } from 'lucide-react'
import { useDialog } from '@/components/ui/useDialog'
import { BACKDROP_CLASS, SHEET_SAFE_AREA, type DeleteScope } from './types'

export type EditScopeTarget = { title: string; isHabit: boolean; changes: string[] }

const OPTIONS: Array<{ scope: DeleteScope; icon: typeof Calendar; label: string; hint: string }> = [
  { scope: 'single', icon: Calendar, label: 'Just this one', hint: 'Only this day changes. The rest of the series is untouched.' },
  { scope: 'future', icon: Repeat, label: 'This and following', hint: 'This day and every later one. Earlier days stay as they were.' },
  { scope: 'all', icon: Layers, label: 'All events', hint: 'Every day in the series, past and future.' },
]

/**
 * Edit-scope prompt — mirrors DeleteScopeDialog. Saving a change to a
 * repeating deed or habit asks how far it should reach, so one edit never
 * silently rewrites other days. Mount inside <AnimatePresence> only while a
 * save is pending.
 */
export function EditScopeDialog({
  target,
  onChoose,
  onClose,
}: {
  target: EditScopeTarget
  onChoose: (scope: DeleteScope) => void
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
        aria-label="Apply changes to repeating deed"
        tabIndex={-1}
        data-lenis-prevent
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className={`max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-gold-dim/25 bg-surface-solid outline-none sm:max-w-md sm:rounded-2xl ${SHEET_SAFE_AREA}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="border-b border-white/10 px-6 py-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gold">
            {target.isHabit ? 'Edit habit' : 'Edit repeating deed'}
          </p>
          <h3 className="mt-1 truncate font-display text-lg font-bold text-ink">{target.title}</h3>
          {target.changes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {target.changes.map(c => (
                <span key={c} className="rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold">{c}</span>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-ink/50">This one repeats. Apply these changes to…</p>
        </div>

        <div className="space-y-1.5 px-4 py-4">
          {OPTIONS.map(({ scope, icon: Icon, label, hint }) => (
            <button
              key={scope}
              onClick={() => onChoose(scope)}
              className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.06] focus-visible:bg-white/[0.06] focus-visible:outline-none"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gold/70" />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{label}</span>
                <span className="block text-[11px] text-ink/45">{hint}</span>
              </span>
            </button>
          ))}
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
