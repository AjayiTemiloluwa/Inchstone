'use client'

import { useEffect, useRef, useState } from 'react'
import { useHierarchyStore, Item } from '@/stores/hierarchyStore'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useRouter, useParams } from 'next/navigation'
import { ChevronRight, Trash2, Lock, Unlock, RotateCcw } from 'lucide-react'
import { format, addDays } from 'date-fns'
import { Loader } from '@/components/ui/Loader'
import { InlineEdit } from '@/components/ui/InlineEdit'
import { ReflectionPicker } from '@/components/ui/ReflectionPicker'
import { useToast } from '@/components/ui/ToastProvider'
import { Page, PageHeader, Section, Panel, EmptyState, Button, IconButton, RowActions, Badge, inputClass, cx } from '@/components/ds'
import { Meter } from '../../calendar/_components/PeriodNav'

/** Turn the flat /api/items payload into the nested tree the store expects. */
function buildItemTree(flat: Item[]): Item[] {
  const itemMap = new Map<string, Item>()
  flat.forEach(item => itemMap.set(item.id, { ...item, children: [], tasks: item.tasks || [] }))
  const tree: Item[] = []
  flat.forEach(item => {
    const node = itemMap.get(item.id)
    if (!node) return
    if (item.parentId) { itemMap.get(item.parentId)?.children?.push(node) }
    else { tree.push(node) }
  })
  return tree
}

/* Token-styled range input shared by the weight and score sliders. */
const rangeClass = 'h-1.5 w-full cursor-pointer appearance-none rounded-full bg-parchment/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40'
const microLabel = 'block font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/45'

export default function WeekPage() {
  const router = useRouter()
  const params = useParams()
  const weekId = params.id as string

  const { items, completionMap, setItems, updateItem, updateItemScoreMode } = useHierarchyStore()
  const [loading, setLoading] = useState(true)
  const { showToast, confirm } = useToast()
  const [reflectionDraft, setReflectionDraft] = useState<string | null>(null)
  const reflectionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [weekScoreMode, setWeekScoreMode] = useState<'auto' | 'manual'>('auto')

  const [lockedWeights, setLockedWeights] = useState<Record<string, boolean>>({})
  const [dayWeights, setDayWeights] = useState<Record<string, number>>({})

  useEffect(() => {
    fetch('/api/items').then(r => r.json()).then(data => {
      if (data.items) {
        setItems(buildItemTree(data.items as Item[]))
      }
    }).finally(() => setLoading(false))
  }, [setItems])

  const findItem = (id: string): Item | undefined => {
    const search = (nodes: Item[]): Item | undefined => {
      for (const n of nodes) { if (n.id === id) return n; if (n.children) { const f = search(n.children); if (f) return f } }
      return undefined
    }
    return search(items)
  }

  const weekItem = findItem(weekId)
  const dailyGoals = weekItem?.children?.filter(c => c.layer === 6) || []
  const parentMonth = weekItem?.parentId ? findItem(weekItem.parentId) : undefined
  const parentQuarter = parentMonth?.parentId ? findItem(parentMonth.parentId) : undefined
  const parentYearlyGoal = parentQuarter?.parentId ? findItem(parentQuarter.parentId) : undefined
  const parentCategory = parentYearlyGoal?.parentId ? findItem(parentYearlyGoal.parentId) : undefined

  const weekStart = weekItem?.startDate ? new Date(weekItem.startDate) : new Date()
  const weekEnd = weekItem?.endDate ? new Date(weekItem.endDate) : addDays(weekStart, 6)
  const totalDays = Math.round((weekEnd.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 1

  // Auto-create days if none exist - calculate proper day count based on week date range
  const needsDays = !!weekItem && dailyGoals.length === 0
  const weekItemId = weekItem?.id
  const weekStartIso = weekItem?.startDate ?? null
  const weekEndIso = weekItem?.endDate ?? null
  useEffect(() => {
    if (loading || !needsDays || !weekItemId) return
    let cancelled = false
    const run = async () => {
      const startD = weekStartIso ? new Date(weekStartIso) : new Date()
      const endD = weekEndIso ? new Date(weekEndIso) : addDays(startD, 6)
      const days = Math.round((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1
      const perWeight = Math.round((100 / days) * 10) / 10
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      for (let d = 0; d < days; d++) {
        const dDate = addDays(startD, d)
        const dayName = dayNames[dDate.getDay()]
        const dateStr = format(dDate, 'yyyy-MM-dd')
        await fetch('/api/items', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ layer: 6, parentId: weekItemId, title: dayName, weight: perWeight, startDate: dateStr, endDate: dateStr })
        })
      }
      const res = await fetch('/api/items')
      const data = await res.json()
      if (data.items && !cancelled) {
        setItems(buildItemTree(data.items as Item[]))
        setDayWeights({})
      }
    }
    void run()
    return () => { cancelled = true }
  }, [loading, needsDays, weekItemId, weekStartIso, weekEndIso, setItems])

  // Effective weights: local edits win, otherwise the stored weight
  const effWeights: Record<string, number> = {}
  dailyGoals.forEach(m => { effWeights[m.id] = dayWeights[m.id] ?? m.weight ?? 0 })

  const handleWeightChange = (dayId: string, newVal: number) => {
    const newWeights = { ...effWeights }
    newWeights[dayId] = newVal

    const newLocked = { ...lockedWeights, [dayId]: true }
    setLockedWeights(newLocked)

    const lockedSum = Object.entries(newWeights)
      .filter(([id]) => newLocked[id])
      .reduce((sum, [, w]) => sum + w, 0)

    if (lockedSum > 100) {
      newWeights[dayId] = newVal - (lockedSum - 100)
      return
    }

    const unlockedIds = dailyGoals.filter(m => !newLocked[m.id]).map(m => m.id)
    const remainder = 100 - lockedSum
    const perUnlocked = unlockedIds.length > 0 ? remainder / unlockedIds.length : 0

    unlockedIds.forEach(id => {
      newWeights[id] = Math.round(perUnlocked * 10) / 10
    })

    setDayWeights(newWeights)
    Object.entries(newWeights).forEach(([id, w]) => {
      updateItem(id, { weight: w })
    })
  }

  const resetWeights = () => {
    const equal = Math.round((100 / dailyGoals.length) * 10) / 10
    const newWeights: Record<string, number> = {}
    dailyGoals.forEach(m => { newWeights[m.id] = equal })
    setDayWeights(newWeights)
    setLockedWeights({})
    Object.entries(newWeights).forEach(([id, w]) => {
      updateItem(id, { weight: w })
    })
  }

  const toggleLock = (dayId: string) => {
    setLockedWeights(prev => ({ ...prev, [dayId]: !prev[dayId] }))
  }

  const handleScoreChange = (dayId: string, newScore: number) => {
    updateItemScoreMode(dayId, 'manual', newScore)
  }

  const resetScores = () => {
    dailyGoals.forEach(d => updateItemScoreMode(d.id, 'auto'))
  }

  const reflectionText = reflectionDraft ?? weekItem?.reflection ?? ''

  const saveReflection = (text: string) => {
    if (!weekItem) return
    const id = weekItem.id
    if (reflectionTimer.current) clearTimeout(reflectionTimer.current)
    reflectionTimer.current = setTimeout(() => { updateItem(id, { reflection: text }) }, 800)
  }

  // `e` is null when the delete comes from a <RowActions> menu (it already stops propagation).
  const handleDelete = async (e: React.MouseEvent | null, id: string) => {
    e?.stopPropagation()
    if (!(await confirm('Are you sure you want to delete this? All nested tasks will also be deleted.'))) return
    try {
      const res = await fetch(`/api/items/${id}`, { method: 'DELETE' })
      if (!res.ok) { showToast('Failed to delete item', 'error') }
      else {
        if (id === weekId) { router.push(`/month/${parentMonth?.id || ''}`) }
        else {
          fetch('/api/items').then(r => r.json()).then(data => {
            if (data.items) {
              setItems(buildItemTree(data.items as Item[]))
              setDayWeights({})
            }
          })
        }
      }
    } catch (e) { console.error(e) }
  }

  if (loading) return <Loader label="Charting the week ahead…" routeKey="week" />
  if (!weekItem) {
    return (
      <Page width="narrow">
        <EmptyState title="Week not found." action={<Button variant="secondary" href="/year">Back to the year</Button>} />
      </Page>
    )
  }

  const wScore = completionMap[weekItem.id] || 0
  const dayWeightSum = dailyGoals.reduce((s, m) => s + (effWeights[m.id] ?? 0), 0)

  // Build day slots matching the actual length of this week
  const daySlots = Array.from({ length: totalDays }, (_, i) => {
    const date = addDays(weekStart, i)
    const dayGoal = dailyGoals.find(dg => {
      if (!dg.startDate) return false
      return new Date(dg.startDate).toDateString() === date.toDateString()
    })
    return { date, dayGoal }
  })

  const crumbLink = 'rounded transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40'
  const crumbSep = <ChevronRight className="h-3 w-3 shrink-0 text-parchment/25" aria-hidden="true" />

  return (
    <Page width="wide" className="pb-12">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="-mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-mono text-parchment/45 sm:-mb-6">
        <button type="button" onClick={() => router.push('/year')} className={crumbLink}>Year</button>
        {crumbSep}
        {parentCategory && <><span>{parentCategory.title}</span>{crumbSep}</>}
        {parentYearlyGoal && <><span>{parentYearlyGoal.title}</span>{crumbSep}</>}
        {parentQuarter && <><button type="button" onClick={() => router.push(`/quarter/${parentQuarter.id}`)} className={crumbLink}>{parentQuarter.title}</button>{crumbSep}</>}
        {parentMonth && <><button type="button" onClick={() => router.push(`/month/${parentMonth.id}`)} className={crumbLink}>{parentMonth.startDate ? format(new Date(parentMonth.startDate), 'MMM') : parentMonth.title}</button>{crumbSep}</>}
        <span aria-current="page" className="text-parchment/80">{weekItem.title}</span>
      </nav>

      {/* Week header */}
      <PageHeader
        eyebrow="Week"
        title={
          <InlineEdit value={weekItem.title} onSave={(t) => updateItem(weekItem.id, { title: t })} title="Rename week"
            inputClassName="w-full min-w-0 rounded-lg border border-gold/40 bg-ink/40 px-2 py-1 font-display text-h1 text-parchment outline-none focus:ring-2 focus:ring-gold/30" />
        }
        description={
          <span className="font-mono text-mono tabular-nums">
            {format(weekStart, 'EEE, MMM d')} – {format(weekEnd, 'EEE, MMM d, yyyy')}
          </span>
        }
        actions={
          <>
            <div className="flex items-center gap-3 pr-1">
              <ProgressRing progress={wScore} size={56} trackColorClass="text-parchment/10" />
              <span className="font-mono text-mono tabular-nums text-parchment/70">{Math.round(wScore)}%</span>
            </div>
            <Button
              variant={weekScoreMode === 'manual' ? 'primary' : 'secondary'}
              size="sm"
              aria-pressed={weekScoreMode === 'manual'}
              title="Toggle between automatic and manual week score"
              className="min-h-11 pointer-fine:min-h-9"
              onClick={() => {
                const newMode = weekScoreMode === 'manual' ? 'auto' : 'manual'
                setWeekScoreMode(newMode)
                updateItemScoreMode(weekItem.id, newMode, newMode === 'manual' ? Math.round(wScore) : undefined)
              }}
            >
              {weekScoreMode === 'manual' ? 'Manual' : 'Auto'}
            </Button>
            <IconButton icon={Trash2} label="Delete week" tone="danger" onClick={(e) => handleDelete(e, weekItem.id)} />
          </>
        }
      />

      {/* Week & days */}
      <Section
        title="Week & days"
        id="week-days"
        action={
          <>
            <Button variant="ghost" size="sm" icon={RotateCcw} onClick={resetWeights}>Reset equal</Button>
            <Button variant="ghost" size="sm" onClick={resetScores}>Auto scores</Button>
          </>
        }
      >
        <div className="space-y-6">
          {/* The week itself */}
          <Panel className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="min-w-0 text-heading text-parchment">
                <InlineEdit value={weekItem.title} onSave={(t) => updateItem(weekItem.id, { title: t })} title="Rename week"
                  inputClassName="w-full min-w-0 rounded-lg border border-gold/40 bg-ink/40 px-2 py-1 text-heading text-parchment outline-none focus:ring-2 focus:ring-gold/30" />
              </h3>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <span className={microLabel}>Score</span>
                  <input type="number" min="0" max="100" value={Math.round(wScore)}
                    onChange={e => updateItem(weekItem.id, { progress: parseFloat(e.target.value) || 0 })}
                    className={cx(inputClass, 'w-20 px-2 text-right font-mono tabular-nums pointer-fine:min-h-9')} />
                  <span className="font-mono text-mono text-parchment/45">%</span>
                </label>
                <Badge tone="gold">{Math.round(weekItem.weight || 0)}% weight</Badge>
              </div>
            </div>
            <label className="block space-y-2">
              <span className={microLabel}>Week weight (relative to month)</span>
              <input type="range" min={0} max={100} step={1} value={weekItem.weight || 0}
                onChange={(e) => updateItem(weekItem.id, { weight: parseFloat(e.target.value) || 0 })}
                className={cx(rangeClass, 'accent-gold')} />
            </label>
            <Meter value={wScore} tone="moss" label="Week score" />
          </Panel>

          {/* The days */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className={microLabel}>Days</span>
              <Badge tone={Math.round(dayWeightSum) === 100 ? 'moss' : 'ember'}>Total {Math.round(dayWeightSum)}%</Badge>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7 xl:gap-2">
              {daySlots.map(({ date, dayGoal }, idx) => {
                const isToday = new Date().toDateString() === date.toDateString()
                const dScore = dayGoal ? (completionMap[dayGoal.id] || 0) : 0
                const w = dayGoal ? (effWeights[dayGoal.id] ?? 0) : 0
                const isLocked = dayGoal ? (lockedWeights[dayGoal.id] || false) : false

                return (
                  <Panel
                    key={idx}
                    padded={false}
                    aria-label={dayGoal ? `Open ${format(date, 'EEEE, MMMM d')}` : undefined}
                    className={cx('group relative flex flex-col p-4 xl:p-3', isToday && 'border-gold/60', !dayGoal && 'border-dashed')}
                    onClick={dayGoal ? () => router.push(`/day/${format(date, 'yyyy-MM-dd')}`) : undefined}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={cx('font-mono text-[11px] uppercase tracking-[0.2em]', isToday ? 'text-gold' : 'text-parchment/50')}>{format(date, 'EEE')}</p>
                        <p className={cx('font-display text-heading tabular-nums', isToday ? 'text-gold' : 'text-parchment')}>{format(date, 'd')}</p>
                      </div>
                      {dayGoal && (
                        <span onKeyDown={e => e.stopPropagation()}><RowActions
                          label={`${format(date, 'EEEE')} actions`}
                          className="-mr-2 -mt-2"
                          actions={[{ label: 'Delete day', icon: Trash2, destructive: true, onSelect: () => handleDelete(null, dayGoal.id) }]}
                        /></span>
                      )}
                    </div>

                    {dayGoal ? (
                      <>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                            <IconButton
                              icon={isLocked ? Lock : Unlock}
                              label={isLocked ? 'Unlock weight' : 'Lock weight'}
                              aria-pressed={isLocked}
                              className={cx('-ml-2', isLocked && 'text-gold hover:text-gold')}
                              onClick={(e) => { e.stopPropagation(); toggleLock(dayGoal.id); }}
                            />
                          </span>
                          <div className="flex items-center gap-2">
                            <ProgressRing progress={dScore} size={28} trackColorClass="text-parchment/10" />
                            <span className="font-mono text-mono tabular-nums text-parchment/80">{Math.round(dScore)}%</span>
                          </div>
                        </div>

                        <div className="mt-4 space-y-3" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                          <label className="block space-y-1">
                            <span className="flex items-baseline justify-between">
                              <span className={microLabel}>Weight</span>
                              <span className="font-mono text-[10px] tabular-nums text-parchment/50">{Math.round(w)}%</span>
                            </span>
                            <input type="range" min="0" max="100" step={1} value={w}
                              onChange={e => handleWeightChange(dayGoal.id, parseFloat(e.target.value) || 0)}
                              className={cx(rangeClass, 'accent-gold')} />
                          </label>
                          <label className="block space-y-1">
                            <span className="flex items-baseline justify-between">
                              <span className={microLabel}>Score</span>
                              <span className="font-mono text-[10px] tabular-nums text-parchment/50">{Math.round(dScore)}%</span>
                            </span>
                            <input type="range" min="0" max="100" step={1} value={Math.round(dScore)}
                              onChange={e => handleScoreChange(dayGoal!.id, parseFloat(e.target.value) || 0)}
                              className={cx(rangeClass, 'accent-moss')} />
                          </label>
                        </div>
                      </>
                    ) : (
                      <p className="mt-3 text-caption text-parchment/30">No goal set</p>
                    )}
                  </Panel>
                )
              })}
            </div>
            {dailyGoals.length === 0 && (
              <p className="text-caption text-parchment/40">No days yet.</p>
            )}
          </div>
        </div>
      </Section>

      {/* Reflection */}
      <Section title="Week reflection" id="week-reflection">
        <Panel className="space-y-3">
          <ReflectionPicker
            timePeriod="week"
            periodKey={weekId}
            itemId={weekItem?.id || null}
            onSelect={(content) => { setReflectionDraft(content) }}
            className="mb-2"
          />
          <textarea value={reflectionText}
            aria-label="Week reflection"
            onChange={(e) => { setReflectionDraft(e.target.value); saveReflection(e.target.value) }}
            placeholder="Reflect on this week..."
            className={cx(inputClass, 'h-32 resize-none py-3 leading-relaxed')} />
          <p className="text-caption text-parchment/40">Auto-saves as you type — pick a saved template above to quick-fill.</p>
        </Panel>
      </Section>
    </Page>
  )
}
