'use client'

import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronDown, Download, Pencil, X } from 'lucide-react'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { CountUp, RevealLines } from '@/components/ui/motion'
import { YearDropdownFloating } from '@/components/ui/YearPicker'
import { useHierarchyStore, type Item } from '@/stores/hierarchyStore'

interface YearHeroProps {
  yearItem: Item
  activeYear: number
  score: number
  onDownloadReport: () => void
}

// A stored anchor that looks like a Bible reference (the old seeded
// "Proverbs 16:3") is replaced by a warm quote instead of a citation.
const isBibleRef = (s: string) => /^\d?\s?[A-Za-z]+\s\d+:\d+$/i.test(s.trim())
const DEFAULT_ANCHOR = 'Discipline is the quiet art of keeping your promises to yourself.'

/** Year banner: year picker, optional chapter name, anchor quote, focus question, overall progress. */
export function YearHero({ yearItem, activeYear, score, onDownloadReport }: YearHeroProps) {
  const updateItem = useHierarchyStore(s => s.updateItem)
  const [editYearName, setEditYearName] = useState(false)
  const [yearNameDraft, setYearNameDraft] = useState('')
  const [editingAnchor, setEditingAnchor] = useState(false)
  const [anchorDraft, setAnchorDraft] = useState('')
  const [editingFocus, setEditingFocus] = useState(false)
  const [focusDraft, setFocusDraft] = useState('')
  const [yearMenuOpen, setYearMenuOpen] = useState(false)
  const yearTriggerRef = useRef<HTMLDivElement>(null)

  const anchorLine = yearItem.anchorScripture && !isBibleRef(yearItem.anchorScripture)
    ? yearItem.anchorScripture.trim()
    : DEFAULT_ANCHOR

  const startNameEdit = () => {
    setYearNameDraft(yearItem.theme || yearItem.title || '')
    setEditYearName(true)
  }
  const saveYearName = () => {
    const next = yearNameDraft.trim()
    updateItem(yearItem.id, { theme: next || null, title: next ? `${activeYear} · ${next}` : String(activeYear) })
    setEditYearName(false)
  }
  const startAnchorEdit = () => {
    setAnchorDraft(yearItem.anchorScripture && !isBibleRef(yearItem.anchorScripture) ? yearItem.anchorScripture : '')
    setEditingAnchor(true)
  }
  const saveAnchorQuote = () => {
    updateItem(yearItem.id, { anchorScripture: anchorDraft.trim() || null })
    setEditingAnchor(false)
  }
  const startFocusEdit = () => {
    setFocusDraft(yearItem.focusQuestion || '')
    setEditingFocus(true)
  }
  const saveFocusQuestion = () => {
    updateItem(yearItem.id, { focusQuestion: focusDraft.trim() || null })
    setEditingFocus(false)
  }

  return (
    <div className="glass-gold rounded-[8px] p-6 sm:p-8 text-center animate-slideUp border border-gold/20 relative overflow-hidden">
      <div aria-hidden="true" data-parallax="0.22" className="pointer-events-none absolute -top-28 -right-16 w-80 h-80 rounded-full bg-gold/10 blur-3xl" />
      <div aria-hidden="true" data-parallax="-0.14" className="pointer-events-none absolute -bottom-24 -left-16 w-64 h-64 rounded-full bg-sage/10 blur-3xl" />
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-parchment/40">A year in focus</p>

      {/* The year number is the hero: tap it to open the year workspace picker */}
      <div ref={yearTriggerRef} className="relative mt-1 inline-block max-w-full">
        <button type="button" onClick={() => setYearMenuOpen(o => !o)} aria-haspopup="menu" aria-expanded={yearMenuOpen}
          data-cursor="Switch year" className="group inline-flex cursor-pointer items-start justify-center outline-none">
          <motion.span whileTap={{ scale: 0.96 }} transition={{ type: 'spring', stiffness: 600, damping: 30 }}
            className="font-display text-[clamp(4rem,16vw,11rem)] leading-[0.95] font-bold text-parchment tabular-nums tracking-[-0.02em] transition-colors group-hover:text-gold">
            <RevealLines key={activeYear} delay={80} fluid lines={[String(activeYear)]} />
          </motion.span>
          <motion.span aria-hidden animate={{ rotate: yearMenuOpen ? 180 : 0, y: yearMenuOpen ? -4 : 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className="ml-1 mt-3 inline-flex text-gold-dim/70 transition-colors group-hover:text-gold sm:mt-5">
            <ChevronDown className="h-5 w-5 sm:h-7 sm:w-7" />
          </motion.span>
        </button>
      </div>
      <AnimatePresence>
        {yearMenuOpen && <YearDropdownFloating anchor={yearTriggerRef} onClose={() => setYearMenuOpen(false)} />}
      </AnimatePresence>

      {/* Optional name: the user chooses whether to name the year */}
      <div className="mt-5 flex min-h-[40px] items-center justify-center">
        {editYearName ? (
          <div className="flex items-center gap-2 max-w-full">
            <input autoFocus value={yearNameDraft} onChange={e => setYearNameDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveYearName(); if (e.key === 'Escape') setEditYearName(false) }}
              placeholder='Name this chapter — e.g. "The Foundation Year"'
              className="w-48 min-w-0 sm:w-72 rounded-xl border border-gold/30 bg-black/25 px-4 py-2 text-center text-base font-semibold text-parchment focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-parchment/30" />
            <button type="button" onClick={saveYearName} aria-label="Save name" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gold/15 text-gold transition-colors hover:bg-gold/25">
              <Check className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setEditYearName(false)} aria-label="Cancel" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-parchment/50 transition-colors hover:bg-white/5 hover:text-parchment">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button type="button" onClick={startNameEdit}
            className={`group inline-flex items-center gap-2 rounded-full border border-dashed px-4 py-1.5 text-sm transition-colors ${
              yearItem.theme ? 'border-white/15 text-parchment/85 hover:border-gold/40 hover:text-gold' : 'border-white/12 text-parchment/45 hover:border-gold/40 hover:text-parchment'
            }`}>
            <span>{yearItem.theme || 'Name this chapter'}</span>
            <Pencil className="h-3.5 w-3.5 text-parchment/40 transition-colors group-hover:text-gold" />
          </button>
        )}
      </div>

      <div className="group/quote relative mx-auto mt-6 max-w-2xl">
        {editingAnchor ? (
          <div className="flex items-center justify-center gap-2">
            <input autoFocus value={anchorDraft} onChange={e => setAnchorDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveAnchorQuote(); if (e.key === 'Escape') setEditingAnchor(false) }}
              onBlur={saveAnchorQuote} placeholder="Your anchor for this year…"
              className="w-full max-w-xl min-w-0 rounded-xl border border-gold/30 bg-black/25 px-4 py-2 text-center font-serif text-lg italic text-parchment focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-parchment/30" />
            <button type="button" onClick={saveAnchorQuote} aria-label="Save anchor" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gold/15 text-gold transition-colors hover:bg-gold/25">
              <Check className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setEditingAnchor(false)} aria-label="Cancel anchor" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-parchment/50 transition-colors hover:bg-white/5 hover:text-parchment">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <p className="font-serif text-lg italic leading-relaxed text-parchment/80 sm:text-xl">&ldquo;{anchorLine}&rdquo;</p>
        )}
        {!editingAnchor && (
          <button type="button" onClick={startAnchorEdit} title="Edit anchor quote" aria-label="Edit anchor quote"
            className="absolute -right-2 -top-3 grid h-9 w-9 place-items-center rounded-lg text-parchment/40 sm:text-parchment/25 sm:opacity-0 transition hover:bg-white/5 hover:text-gold group-hover/quote:opacity-100 focus-visible:opacity-100">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Focus question pill: click to edit */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {editingFocus ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-white/[0.03] px-3 py-1.5 max-w-full">
            <input autoFocus value={focusDraft} onChange={e => setFocusDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveFocusQuestion(); if (e.key === 'Escape') setEditingFocus(false) }}
              onBlur={saveFocusQuestion} placeholder="What is your focus question?"
              className="w-48 min-w-0 sm:w-72 bg-transparent text-xs text-parchment/80 outline-none placeholder:text-parchment/30" />
            {focusDraft.trim() && (
              <button type="button" onClick={saveFocusQuestion} aria-label="Save focus question" className="text-gold hover:text-gold/80">
                <Check className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : (
          <button type="button" onClick={startFocusEdit} title={yearItem.focusQuestion ? 'Edit focus question' : 'Add a focus question'}
            className={`group/focus inline-flex flex-wrap items-center justify-center gap-2 rounded-full border px-4 py-1.5 text-xs transition ${
              yearItem.focusQuestion ? 'border-white/10 bg-white/[0.03] text-parchment/60 hover:border-gold/40 hover:text-gold' : 'border-dashed border-white/10 text-parchment/30 hover:border-gold/40 hover:text-parchment/60'
            }`}>
            <span className="h-1.5 w-1.5 rounded-full bg-gold" />
            {yearItem.focusQuestion || 'Add a focus question'}
            <Pencil className="h-2.5 w-2.5 text-parchment/30 transition group-hover/focus:text-gold" />
          </button>
        )}
      </div>

      <div className="max-w-md mx-auto mt-6 sm:mt-8 bg-black/20 p-4 sm:p-6 rounded-[8px] backdrop-blur-sm border border-white/5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold uppercase text-ink/60">Overall Progress</span>
          <button type="button" onClick={onDownloadReport} aria-label="Download report"
            className="px-3 py-2 bg-gold/10 text-gold border border-gold/30 text-xs font-bold rounded-lg hover:bg-gold/20 active:opacity-70 transition-all flex items-center space-x-1.5 min-h-[40px]">
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Report</span>
          </button>
        </div>
        <div className="flex justify-between items-end mb-2">
          <span className="text-2xl sm:text-3xl font-bold font-mono bg-gradient-to-r from-gold to-gold-glow bg-clip-text text-transparent">
            <CountUp value={score} format={n => `${Math.round(n)}%`} />
          </span>
        </div>
        <ProgressBar progress={score} />
      </div>
    </div>
  )
}
