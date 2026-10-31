'use client'

import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronDown, Download, Pencil, X } from 'lucide-react'
import { Button, IconButton, PageHeader, Panel, cx } from '@/components/ds'
import { CountUp, RevealLines } from '@/components/ui/motion'
import { WorkClock } from '@/components/ui/WorkClock'
import { YearDropdownFloating } from '@/components/ui/YearPicker'
import { useHierarchyStore, type Item } from '@/stores/hierarchyStore'
import { Meter } from '../primitives'

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

const editField = 'min-w-0 rounded-lg border border-gold/30 bg-ink/40 px-3 text-parchment placeholder:text-parchment/30 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/20'

/**
 * Year header + hero: the year number (tap to switch year), the report action,
 * then one instrument panel with the work clock carrying the year's progress
 * beside the chapter name, anchor quote and focus question.
 */
export function YearHero({ yearItem, activeYear, score, onDownloadReport }: YearHeroProps) {
  const updateItem = useHierarchyStore(s => s.updateItem)
  const [editYearName, setEditYearName] = useState(false)
  const [yearNameDraft, setYearNameDraft] = useState('')
  const [editingAnchor, setEditingAnchor] = useState(false)
  const [anchorDraft, setAnchorDraft] = useState('')
  const [editingFocus, setEditingFocus] = useState(false)
  const [focusDraft, setFocusDraft] = useState('')
  const [yearMenuOpen, setYearMenuOpen] = useState(false)
  const yearTriggerRef = useRef<HTMLSpanElement>(null)

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
    <>
      <PageHeader
        eyebrow="Year view · A year in focus"
        title={
          // The year number is the title: tap it to open the year workspace picker.
          <span ref={yearTriggerRef} className="relative inline-block max-w-full">
            <button type="button" onClick={() => setYearMenuOpen(o => !o)} aria-haspopup="menu" aria-expanded={yearMenuOpen}
              aria-label={`Year ${activeYear}, switch year`} data-cursor="Switch year"
              className="group inline-flex cursor-pointer items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-gold/40">
              <motion.span whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 600, damping: 30 }}
                className="text-display tabular-nums text-parchment transition-colors group-hover:text-gold">
                <RevealLines key={activeYear} delay={80} fluid lines={[String(activeYear)]} />
              </motion.span>
              <motion.span aria-hidden animate={{ rotate: yearMenuOpen ? 180 : 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                className="inline-flex text-gold-dim transition-colors group-hover:text-gold">
                <ChevronDown className="h-6 w-6" strokeWidth={1.75} />
              </motion.span>
            </button>
          </span>
        }
        actions={<Button icon={Download} onClick={onDownloadReport} aria-label="Download report">Report</Button>}
      />
      <AnimatePresence>
        {yearMenuOpen && <YearDropdownFloating anchor={yearTriggerRef} onClose={() => setYearMenuOpen(false)} />}
      </AnimatePresence>

      <Panel className="grid items-center gap-6 sm:gap-8 md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex justify-center md:justify-start">
          <WorkClock size={168} progress={Math.min(100, Math.max(0, score))} primary={String(Math.round(score))} ringLabel="YEAR" />
        </div>

        <div className="min-w-0 space-y-5">
          {/* Optional name: the user chooses whether to name the year */}
          <div className="flex min-h-11 items-center">
            {editYearName ? (
              <div className="flex w-full max-w-md items-center gap-2">
                <input autoFocus value={yearNameDraft} onChange={e => setYearNameDraft(e.target.value)} aria-label="Chapter name"
                  onKeyDown={e => { if (e.key === 'Enter') saveYearName(); if (e.key === 'Escape') setEditYearName(false) }}
                  placeholder='Name this chapter — e.g. "The Foundation Year"'
                  className={cx(editField, 'h-11 flex-1 text-heading')} />
                <IconButton icon={Check} label="Save name" onClick={saveYearName} />
                <IconButton icon={X} label="Cancel" onClick={() => setEditYearName(false)} />
              </div>
            ) : (
              <button type="button" onClick={startNameEdit}
                className={cx(
                  'group inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40',
                  yearItem.theme ? 'text-heading text-parchment hover:text-gold' : 'text-body text-parchment/45 hover:text-parchment',
                )}>
                <span className="truncate">{yearItem.theme || 'Name this chapter'}</span>
                <Pencil aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-parchment/35 transition-colors group-hover:text-gold" />
              </button>
            )}
          </div>

          {/* Anchor quote */}
          <div className="group/quote flex items-start gap-2">
            {editingAnchor ? (
              <div className="flex w-full items-center gap-2">
                <input autoFocus value={anchorDraft} onChange={e => setAnchorDraft(e.target.value)} aria-label="Anchor quote"
                  onKeyDown={e => { if (e.key === 'Enter') saveAnchorQuote(); if (e.key === 'Escape') setEditingAnchor(false) }}
                  onBlur={saveAnchorQuote} placeholder="Your anchor for this year…"
                  className={cx(editField, 'h-11 flex-1 font-display text-body italic')} />
                <IconButton icon={Check} label="Save anchor" onClick={saveAnchorQuote} />
                <IconButton icon={X} label="Cancel anchor" onClick={() => setEditingAnchor(false)} />
              </div>
            ) : (
              <>
                <p className="min-w-0 flex-1 font-display text-heading italic leading-relaxed text-parchment/80">&ldquo;{anchorLine}&rdquo;</p>
                <IconButton icon={Pencil} label="Edit anchor quote" onClick={startAnchorEdit}
                  className="can-hover:opacity-0 can-hover:group-hover/quote:opacity-100 focus-visible:opacity-100" />
              </>
            )}
          </div>

          {/* Focus question: click to edit */}
          <div className="flex flex-wrap items-center gap-2">
            {editingFocus ? (
              <div className="flex w-full max-w-md items-center gap-2">
                <input autoFocus value={focusDraft} onChange={e => setFocusDraft(e.target.value)} aria-label="Focus question"
                  onKeyDown={e => { if (e.key === 'Enter') saveFocusQuestion(); if (e.key === 'Escape') setEditingFocus(false) }}
                  onBlur={saveFocusQuestion} placeholder="What is your focus question?"
                  className={cx(editField, 'h-11 flex-1 text-sm')} />
                {focusDraft.trim() && <IconButton icon={Check} label="Save focus question" onClick={saveFocusQuestion} />}
              </div>
            ) : (
              <button type="button" onClick={startFocusEdit} title={yearItem.focusQuestion ? 'Edit focus question' : 'Add a focus question'}
                className={cx(
                  'group/focus inline-flex min-h-9 max-w-full items-center gap-2 rounded-full border px-4 py-1.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40',
                  yearItem.focusQuestion ? 'border-gold/20 text-parchment/70 hover:border-gold/40 hover:text-gold' : 'border-dashed border-gold/20 text-parchment/40 hover:border-gold/40 hover:text-parchment/70',
                )}>
                <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                <span className="min-w-0">{yearItem.focusQuestion || 'Add a focus question'}</span>
                <Pencil aria-hidden="true" className="h-3 w-3 shrink-0 text-parchment/30 transition-colors group-hover/focus:text-gold" />
              </button>
            )}
          </div>

          {/* Overall progress */}
          <div className="space-y-2 pt-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/45">Overall progress</span>
              <span className="font-mono text-heading tabular-nums text-gold">
                <CountUp value={score} format={n => `${Math.round(n)}%`} />
              </span>
            </div>
            <Meter value={score} />
          </div>
        </div>
      </Panel>
    </>
  )
}
