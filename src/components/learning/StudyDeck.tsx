'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { RotateCcw, X } from 'lucide-react'
import { cx } from '@/components/ds'

export interface StudyCard { id: string; front: string; back: string }

const GRADES = [
  { g: 'again', label: 'Again', hint: '10 min', cls: 'border-ember/40 text-ember hover:bg-ember/10' },
  { g: 'hard', label: 'Hard', hint: 'sooner', cls: 'border-gold/25 text-parchment/80 hover:bg-gold/[0.06]' },
  { g: 'good', label: 'Good', hint: 'on time', cls: 'border-gold/40 text-gold hover:bg-gold/10' },
  { g: 'easy', label: 'Easy', hint: 'later', cls: 'border-moss/40 text-moss hover:bg-moss/10' },
] as const

/**
 * Full-screen flashcard study. Tap or Space flips; 1-4 grade the card
 * (Again / Hard / Good / Easy), which schedules its next review (SM-2).
 * "Again" puts the card back at the end of this session.
 */
export function StudyDeck({ cards, title, onClose, onGraded }: { cards: StudyCard[]; title: string; onClose: (reviewed: number) => void; onGraded?: () => void }) {
  const [queue, setQueue] = useState(cards)
  const [flipped, setFlipped] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const card = queue[0]

  const grade = async (g: (typeof GRADES)[number]['g']) => {
    if (!card) return
    setFlipped(false)
    setReviewed((n) => n + 1)
    setQueue((q) => (g === 'again' ? [...q.slice(1), q[0]] : q.slice(1)))
    fetch(`/api/learning/items/card/${card.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grade: g }) })
      .then(() => onGraded?.())
      .catch(() => {})
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(reviewed)
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped((f) => !f) }
      else if (flipped && ['1', '2', '3', '4'].includes(e.key)) void grade(GRADES[Number(e.key) - 1].g)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const total = cards.length
  const left = queue.length

  return (
    <div role="dialog" aria-modal="true" aria-label={`Study ${title}`} className="fixed inset-0 z-[80] flex flex-col bg-ink/95 backdrop-blur-xl" data-lenis-prevent>
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-parchment/45">Studying</p>
          <p className="truncate font-display text-lg text-parchment">{title}</p>
        </div>
        <span className="font-mono text-xs tabular-nums text-parchment/55">{Math.max(0, total - left)}/{total}</span>
        <button type="button" onClick={() => onClose(reviewed)} aria-label="End session" className="flex h-11 w-11 items-center justify-center rounded-xl text-parchment/60 hover:text-parchment"><X className="h-5 w-5" /></button>
      </div>
      <div className="mx-4 h-1 overflow-hidden rounded-full bg-gold/10 sm:mx-6">
        <div className="h-full rounded-full bg-gold transition-[width] duration-500" style={{ width: `${total ? ((total - left) / total) * 100 : 100}%` }} />
      </div>

      <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
        {card ? (
          <div className="w-full max-w-xl [perspective:1400px]">
            <AnimatePresence mode="wait">
              <motion.button
                key={card.id + reviewed}
                type="button"
                onClick={() => setFlipped((f) => !f)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0, rotateY: flipped ? 180 : 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                style={{ transformStyle: 'preserve-3d' }}
                className="relative block aspect-[4/3] w-full sm:aspect-[3/2]"
                aria-label={flipped ? 'Answer. Tap to see the question' : 'Question. Tap to see the answer'}
              >
                <span className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border border-gold/25 bg-surface-solid p-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.45)] [backface-visibility:hidden]">
                  <span className="mb-4 font-mono text-[10px] uppercase tracking-[0.24em] text-gold-dim">Question</span>
                  <span className="font-display text-2xl leading-snug text-parchment sm:text-3xl">{card.front}</span>
                  <span className="mt-6 text-caption text-parchment/40">Tap or press Space to flip</span>
                </span>
                <span className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border border-moss/30 bg-surface-solid p-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.45)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <span className="mb-4 font-mono text-[10px] uppercase tracking-[0.24em] text-moss">Answer</span>
                  <span className="whitespace-pre-wrap text-lg leading-relaxed text-parchment/90 sm:text-xl">{card.back}</span>
                </span>
              </motion.button>
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center">
            <p className="font-display text-4xl text-parchment">Session done</p>
            <p className="mt-2 text-parchment/60">You reviewed {reviewed} card{reviewed === 1 ? '' : 's'}. They will come back when you need them.</p>
            <button type="button" onClick={() => { setQueue(cards); setReviewed(0) }} className="mt-6 inline-flex items-center gap-2 rounded-xl border border-gold/30 px-4 py-2.5 text-sm text-gold hover:bg-gold/10">
              <RotateCcw className="h-4 w-4" /> Go again
            </button>
          </div>
        )}
      </div>

      {card && (
        <div className="grid grid-cols-4 gap-2 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] sm:mx-auto sm:w-full sm:max-w-xl sm:px-0 sm:pb-8">
          {GRADES.map((g, i) => (
            <button key={g.g} type="button" disabled={!flipped} onClick={() => grade(g.g)}
              className={cx('flex min-h-14 flex-col items-center justify-center rounded-2xl border text-sm font-semibold transition-colors disabled:opacity-25', g.cls)}>
              {g.label}
              <span className="font-mono text-[10px] font-normal opacity-70">{g.hint} · {i + 1}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
