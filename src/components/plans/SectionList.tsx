'use client'

/**
 * Overview tab (§3): collapsible Section cards holding Goal rows.
 * Reorder/edit/archive/delete per Goal and per Section; Add-Section asks for
 * a name/description only — PDP fields live one level down.
 */
import { useState } from 'react'
import { ChevronDown, ChevronUp, FolderPlus, Pencil, Plus, Trash2 } from 'lucide-react'
import { usePlansStore } from '@/stores/plansStore'
import type { PlanGoalRecord, PlanSectionRecord } from '@/lib/plans/types'
import { countStatuses } from '@/lib/plans/status'
import { AddSectionModal } from './AddSectionModal'
import { GoalRow } from './GoalRow'

type Props = {
  /** Bubbles up to the page-level detail modal */
  onGoalClick: (goal: PlanGoalRecord, section: PlanSectionRecord) => void
  onGoalEdit: (goal: PlanGoalRecord, section: PlanSectionRecord) => void
  /** Opens an empty goal form for this section */
  onGoalAdd: (section: PlanSectionRecord) => void
}

export function SectionList({ onGoalClick, onGoalEdit, onGoalAdd }: Props) {
  const { currentPlan, reorderSections, reorderGoals, deleteSection, deleteGoal, updateGoal } = usePlansStore()
  const plan = currentPlan

  // Track only *collapsed* sections — every section starts expanded, no effect needed
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [showArchived, setShowArchived] = useState<Set<string>>(new Set())
  const [secModal, setSecModal] = useState<{ open: boolean; initial: PlanSectionRecord | null }>({ open: false, initial: null })

  if (!plan) return null
  const sections = plan.sections ?? []

  const toggle = (id: string) =>
    setCollapsed(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const toggleArchived = (id: string) =>
    setShowArchived(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const moveSection = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir
    if (j < 0 || j >= sections.length) return
    const ids = sections.map(s => s.id)
    ;[ids[idx], ids[j]] = [ids[j], ids[idx]]
    await reorderSections(ids)
  }

  const moveGoal = async (section: PlanSectionRecord, gi: number, dir: -1 | 1) => {
    const goals = section.goals ?? []
    const j = gi + dir
    if (j < 0 || j >= goals.length) return
    const ids = goals.map(g => g.id)
    ;[ids[gi], ids[j]] = [ids[j], ids[gi]]
    await reorderGoals(ids)
  }

  const handleDeleteGoal = async (goal: PlanGoalRecord) => {
    if (!window.confirm('Delete this goal and its milestones/history?')) return
    await deleteGoal(goal.id)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-wider text-parchment/40">
          Sections · {sections.length}
        </p>
        <button
          onClick={() => setSecModal({ open: true, initial: null })}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-parchment/20 px-3 text-xs font-medium text-parchment/75 transition-colors hover:border-gold/40 hover:text-gold"
        >
          <FolderPlus className="h-4 w-4" /> Add Section
        </button>
      </div>

      {sections.length === 0 && (
        <div className="rounded-[8px] border border-dashed border-parchment/20 px-6 py-10 text-center">
          <p className="text-sm text-parchment/55">This plan has zero sections — it’s an empty shell ready to fill.</p>
          <p className="mt-1 text-xs text-parchment/35">Start with areas like Career, Health, Financial or Spiritual.</p>
        </div>
      )}
      {sections.map((section, si) => {
        const goals = section.goals ?? []
        const active = goals.filter(g => !g.archived)
        const archived = goals.filter(g => g.archived)
        const counts = countStatuses(active.map(g => g.status))
        const isOpen = !collapsed.has(section.id)

        return (
          <div key={section.id} className="overflow-hidden rounded-[8px] border hairline bg-black/20">
            {/* Section header */}
            <button
              onClick={() => toggle(section.id)}
              aria-expanded={isOpen}
              className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-mist/40"
            >
              <ChevronDown className={`h-4 w-4 shrink-0 text-parchment/40 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-base text-parchment">{section.name}</span>
                {section.description && (
                  <span className="mt-0.5 block truncate text-xs text-parchment/45">{section.description}</span>
                )}
              </span>
              <span className="shrink-0 font-mono text-[11px] text-parchment/45">
                {counts.total === 0
                  ? 'empty'
                  : `${counts.total} ${counts.total === 1 ? 'goal' : 'goals'}${counts.achieved > 0 ? `, ${counts.achieved} achieved` : ''}`}
              </span>
              {/* Hover actions */}
              <span
                className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 max-lg:opacity-100"
                onClick={e => e.stopPropagation()}
              >
                <button onClick={() => moveSection(si, -1)} disabled={si === 0} aria-label="Move section up" className="rounded p-1.5 text-parchment/40 transition-colors hover:bg-mist hover:text-parchment disabled:opacity-25">
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => moveSection(si, 1)} disabled={si === sections.length - 1} aria-label="Move section down" className="rotate-180 rounded p-1.5 text-parchment/40 transition-colors hover:bg-mist hover:text-parchment disabled:opacity-25">
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setSecModal({ open: true, initial: section })} aria-label="Edit section" className="rounded p-1.5 text-parchment/40 transition-colors hover:bg-mist hover:text-parchment">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={async () => {
                    if (!window.confirm(`Delete section “${section.name}” with all its goals and milestones?`)) return
                    await deleteSection(section.id)
                  }}
                  aria-label="Delete section"
                  className="rounded p-1.5 text-ember/70 transition-colors hover:bg-ember/20 hover:text-[#CD8B70]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            </button>
            {isOpen && (
              <div className="space-y-2 border-t border-parchment/10 px-4 py-3">
                {active.length === 0 && archived.length === 0 && (
                  <p className="py-2 text-xs text-parchment/40">No goals here yet.</p>
                )}

                {active.map((goal, gi) => (
                  <GoalRow
                    key={goal.id}
                    goal={goal}
                    onOpenDetail={() => onGoalClick(goal, section)}
                    onEdit={() => onGoalEdit(goal, section)}
                    onDelete={() => handleDeleteGoal(goal)}
                    onArchiveToggle={() => updateGoal(goal.id, { archived: true })}
                    onMove={dir => moveGoal(section, gi, dir)}
                    moveDisabledUp={gi === 0}
                    moveDisabledDown={gi === active.length - 1}
                  />
                ))}

                {archived.length > 0 && (
                  <div className="pt-1">
                    <button
                      onClick={() => toggleArchived(section.id)}
                      className="text-[11px] font-medium text-parchment/40 underline underline-offset-2 transition-colors hover:text-parchment/70"
                    >
                      {showArchived.has(section.id) ? 'Hide' : 'Show'} archived ({archived.length})
                    </button>
                    {showArchived.has(section.id) && (
                      <div className="mt-2 space-y-2 opacity-75">
                        {archived.map(goal => (
                          <GoalRow
                            key={goal.id}
                            goal={goal}
                            onOpenDetail={() => onGoalClick(goal, section)}
                            onEdit={() => onGoalEdit(goal, section)}
                            onDelete={() => handleDeleteGoal(goal)}
                            onArchiveToggle={() => updateGoal(goal.id, { archived: false })}
                            onMove={() => {}}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={() => onGoalAdd(section)}
                  className="mt-1 inline-flex min-h-9 items-center gap-1 rounded-md border border-dashed border-parchment/20 px-2.5 py-1.5 text-xs text-parchment/55 transition-colors hover:border-gold/40 hover:text-gold"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Goal
                </button>
              </div>
            )}
          </div>
        )
      })}

      {secModal.open && (
        <AddSectionModal
          key={secModal.initial?.id ?? 'new'}
          planId={plan.id}
          initial={secModal.initial}
          onClose={() => setSecModal({ open: false, initial: null })}
        />
      )}
    </div>
  )
}