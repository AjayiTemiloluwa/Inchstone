'use client'

/**
 * Overview tab (§3): collapsible Section groups holding Goal rows.
 * Reorder/edit/archive/delete per Goal and per Section; Add-Section asks for
 * a name/description only — PDP fields live one level down.
 */
import { useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, FolderPlus, Pencil, Plus, Trash2 } from 'lucide-react'
import { usePlansStore } from '@/stores/plansStore'
import type { PlanGoalRecord, PlanSectionRecord } from '@/lib/plans/types'
import { countStatuses } from '@/lib/plans/status'
import { Button, EmptyState, Panel, RowActions, Section, cx, type RowAction } from '@/components/ds'
import { useToast } from '@/components/ui/ToastProvider'
import { AddSectionModal } from './AddSectionModal'
import { GoalRow } from './GoalRow'
import { ProgressSegments } from './ProgressSegments'

type Props = {
  /** Bubbles up to the page-level detail modal */
  onGoalClick: (goal: PlanGoalRecord, section: PlanSectionRecord) => void
  onGoalEdit: (goal: PlanGoalRecord, section: PlanSectionRecord) => void
  /** Opens an empty goal form for this section */
  onGoalAdd: (section: PlanSectionRecord) => void
}

export function SectionList({ onGoalClick, onGoalEdit, onGoalAdd }: Props) {
  const { currentPlan, reorderSections, reorderGoals, deleteSection, deleteGoal, updateGoal } = usePlansStore()
  const { confirm } = useToast()
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
    if (!(await confirm('Delete this goal and its milestones/history?'))) return
    await deleteGoal(goal.id)
  }

  return (
    <Section
      title={<>Sections · <span className="tabular-nums">{sections.length}</span></>}
      action={
        <Button size="sm" icon={FolderPlus} onClick={() => setSecModal({ open: true, initial: null })}>
          Add section
        </Button>
      }
    >
      {sections.length === 0 && (
        <EmptyState
          title="This plan has zero sections"
          body="It’s an empty shell ready to fill. Start with areas like Career, Health, Financial or Spiritual."
        />
      )}

      <div className="space-y-4">
        {sections.map((section, si) => {
          const goals = section.goals ?? []
          const active = goals.filter(g => !g.archived)
          const archived = goals.filter(g => g.archived)
          const counts = countStatuses(active.map(g => g.status))
          const isOpen = !collapsed.has(section.id)
          const bodyId = `section-body-${section.id}`

          const sectionActions: RowAction[] = [
            ...(si > 0 ? [{ label: 'Move section up', icon: ArrowUp, onSelect: () => moveSection(si, -1) }] : []),
            ...(si < sections.length - 1 ? [{ label: 'Move section down', icon: ArrowDown, onSelect: () => moveSection(si, 1) }] : []),
            { label: 'Edit section', icon: Pencil, onSelect: () => setSecModal({ open: true, initial: section }) },
            {
              label: 'Delete section',
              icon: Trash2,
              destructive: true,
              onSelect: async () => {
                if (!(await confirm(`Delete section “${section.name}” with all its goals and milestones?`))) return
                await deleteSection(section.id)
              },
            },
          ]

          return (
            <Panel key={section.id} padded={false}>
              {/* Section header: the toggle and the actions are siblings, never nested buttons */}
              <div className="group flex items-center gap-2 px-3 py-2 sm:px-4">
                <button
                  onClick={() => toggle(section.id)}
                  aria-expanded={isOpen}
                  aria-controls={bodyId}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
                >
                  <ChevronDown
                    className={cx('h-4 w-4 shrink-0 text-parchment/40 transition-transform', !isOpen && '-rotate-90')}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-lg leading-snug text-parchment">{section.name}</span>
                    {section.description && (
                      <span className="mt-0.5 block truncate text-caption text-parchment/50">{section.description}</span>
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-parchment/45">
                    {counts.total === 0
                      ? 'empty'
                      : `${counts.total} ${counts.total === 1 ? 'goal' : 'goals'}${counts.achieved > 0 ? `, ${counts.achieved} achieved` : ''}`}
                  </span>
                </button>
                <RowActions actions={sectionActions} label={`Actions for section ${section.name}`} />
              </div>

              {counts.total > 0 && (
                <ProgressSegments statuses={active.map(g => g.status)} caption={false} className="px-4 pb-3 sm:px-5" />
              )}

              {isOpen && (
                <div id={bodyId} className="border-t border-gold/10 px-3 pb-3 sm:px-5">
                  {active.length === 0 && archived.length === 0 && (
                    <p className="py-4 text-caption text-parchment/45">No goals here yet.</p>
                  )}

                  {active.length > 0 && (
                    <div className="divide-y divide-gold/10">
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
                    </div>
                  )}

                  {archived.length > 0 && (
                    <div className="border-t border-gold/10 pt-2">
                      <Button size="sm" variant="ghost" onClick={() => toggleArchived(section.id)} aria-expanded={showArchived.has(section.id)}>
                        {showArchived.has(section.id) ? 'Hide' : 'Show'} archived (<span className="tabular-nums">{archived.length}</span>)
                      </Button>
                      {showArchived.has(section.id) && (
                        <div className="divide-y divide-gold/10 opacity-70">
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

                  <div className="pt-2">
                    <Button size="sm" variant="ghost" icon={Plus} onClick={() => onGoalAdd(section)}>
                      Add goal
                    </Button>
                  </div>
                </div>
              )}
            </Panel>
          )
        })}
      </div>

      {secModal.open && (
        <AddSectionModal
          key={secModal.initial?.id ?? 'new'}
          planId={plan.id}
          initial={secModal.initial}
          onClose={() => setSecModal({ open: false, initial: null })}
        />
      )}
    </Section>
  )
}
