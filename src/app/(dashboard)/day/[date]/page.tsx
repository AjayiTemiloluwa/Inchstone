'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useHierarchyStore, Item, Task } from '@/stores/hierarchyStore'
import { useRouter, useParams } from 'next/navigation'
import { Plus, X, Clock, Target, Activity, Calendar, SlidersHorizontal } from 'lucide-react'
import { format, parseISO, addDays } from 'date-fns'
import { AnimatePresence } from 'motion/react'
import dynamic from 'next/dynamic'
import { useCountdown, formatCountdown, compactCountdownLabel } from '@/lib/useCountdown'
import { useToast } from '@/components/ui/ToastProvider'
import { DoneView } from '@/components/ui/DoneView'
import { Loader } from '@/components/ui/Loader'
import { AddDeedForm } from '@/components/day/AddDeedForm'
import { DayNotesCard } from '@/components/day/DayNotesCard'
import { DeedDetailModal } from '@/components/day/DeedDetailModal'
import { DeedTable } from '@/components/day/DeedTable'
import { DeleteScopeDialog, type DeleteScopeTarget } from '@/components/day/DeleteScopeDialog'
import { EditScopeDialog, type EditScopeTarget } from '@/components/day/EditScopeDialog'
import { FrogCard } from '@/components/day/FrogCard'
import { GoalCards } from '@/components/day/GoalCards'
import { HabitTracker } from '@/components/day/HabitTracker'
import { ReflectionCard } from '@/components/day/ReflectionCard'
import { useHabitData } from '@/components/day/useHabitData'
import { DaySchedule, type ScheduleEvent } from '@/components/day/schedule/DaySchedule'
import { DayHero, EventCard, MagicAdd, QuickCreate, TasksLane, type QuickCreateValues } from '@/components/day/schedule/ScheduleParts'
import { autoPlan, freeGaps, hhmm } from '@/lib/schedule/layout'
import type { QuickAdd } from '@/lib/schedule/quickAdd'
import { dedupeGoogleEvents, dedupeTasks, withoutDeedMirrors } from '@/components/day/dedupe'
import type { DayNote, DeedModalData, DeleteScope, GoogleEventView, NewDeedValues } from '@/components/day/types'

const RichNoteModal = dynamic(() => import('@/components/ui/RichNoteModal').then(mod => mod.RichNoteModal), { ssr: false })

type StopEvent = { stopPropagation: () => void }

// Every deed carries free-form points (stored in Task.weight). A deed's share of
// the day is its points / the day's total points — nothing has to add up to 100.
const DEFAULT_POINTS = 10

const SHOW_GOOGLE_KEY = 'inchstone:day:showGoogle'

function readShowGoogle(): boolean {
  try {
    const stored = window.localStorage.getItem(SHOW_GOOGLE_KEY)
    return stored === null ? true : stored !== '0'
  } catch {
    return true
  }
}

export default function DayPage() {
  const router = useRouter()
  const params = useParams()
  const dateStr = params.date as string

  const { items, completionMap, setItems, updateItem, updateTask, getFlatItems } = useHierarchyStore()
  const { showToast, confirm } = useToast()
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline')
  const [selectedDeed, setSelectedDeed] = useState<DeedModalData | null>(null)
  const [deedReflection, setDeedReflection] = useState('')
  const [addingDeed, setAddingDeed] = useState(false)
  const [addPrefill, setAddPrefill] = useState({ start: '', end: '' })
  const [savingDeed, setSavingDeed] = useState(false)
  const [dayNotes, setDayNotes] = useState<DayNote[]>([])
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [editingNote, setEditingNote] = useState<DayNote | null>(null)
  const [deleteScopeTarget, setDeleteScopeTarget] = useState<DeleteScopeTarget | null>(null)
  const [pendingEdit, setPendingEdit] = useState<{ taskId: string; changes: Record<string, unknown>; becameRecurring: boolean; target: EditScopeTarget } | null>(null)
  const savingEditRef = useRef(false)
  // Schedule v2: Inchstone calendar events, the quick-create range, an open
  // event card, drag results shown before the server confirms, and planning.
  const [localEvents, setLocalEvents] = useState<ScheduleEvent[]>([])
  const [quick, setQuick] = useState<{ start: number; end: number } | null>(null)
  const [openEvent, setOpenEvent] = useState<ScheduleEvent | null>(null)
  const [retimed, setRetimed] = useState<Record<string, { startTime: string; endTime: string }>>({})
  const [planning, setPlanning] = useState(false)

  const {
    todayHabits,
    setTodayHabits,
    habitOverview,
    habitHistory,
    range: habitGraphRange,
    setRange: setHabitGraphRange,
    customStart: habitGraphCustomStart,
    setCustomStart: setHabitGraphCustomStart,
    customEnd: habitGraphCustomEnd,
    setCustomEnd: setHabitGraphCustomEnd,
    fetchTodayHabits,
    fetchHabitOverview,
    fetchHabitHistory,
    habitSeriesByTitle,
    habitDetail,
  } = useHabitData(dateStr)

  // Google Calendar events for this day — pull-only, rendered as
  // non-checkable gold-dim blockers alongside deeds. The "Google" toggle in
  // the Deeds toolbar flips them on/off (choice remembered across visits).
  const [googleEvents, setGoogleEvents] = useState<GoogleEventView[]>([])
  const [googleConnected, setGoogleConnected] = useState(false)
  const [showGoogle, setShowGoogle] = useState<boolean>(() => (typeof window === 'undefined' ? true : readShowGoogle()))

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const dayStart = new Date(`${dateStr}T00:00:00`)
        const dayEnd = new Date(dayStart.getTime() + 86_400_000)
        const res = await fetch(`/api/calendar/events?timeMin=${dayStart.toISOString()}&timeMax=${dayEnd.toISOString()}`)
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        if (Array.isArray(data.events)) setGoogleEvents(dedupeGoogleEvents(data.events))
        setGoogleConnected(!data.needsAuth)
      } catch {
        /* calendar is optional — never block the day view */
      }
    })()
    return () => { cancelled = true }
  }, [dateStr])

  const loadLocalEvents = useCallback(async () => {
    try {
      const dayStart = new Date(`${dateStr}T00:00:00`)
      const dayEnd = new Date(dayStart.getTime() + 86_400_000)
      const res = await fetch(`/api/events?startDate=${dayStart.toISOString()}&endDate=${dayEnd.toISOString()}`)
      if (!res.ok) return
      const data = await res.json()
      setLocalEvents(((data.events || []) as { id: string; title: string; startTime: string; endTime: string; type?: string }[])
        .filter(e => e.type !== 'google')
        .map(e => ({ id: e.id, title: e.title, startTime: e.startTime, endTime: e.endTime, source: 'inchstone' as const })))
    } catch { /* events are optional */ }
  }, [dateStr])
  useEffect(() => {
    const t = setTimeout(() => { void loadLocalEvents() }, 0)
    return () => clearTimeout(t)
  }, [loadLocalEvents])

  // Remember the Google-events visibility preference per device.
  const toggleGoogle = () => {
    setShowGoogle(v => {
      const next = !v
      try { window.localStorage.setItem(SHOW_GOOGLE_KEY, next ? '1' : '0') } catch { /* storage unavailable */ }
      return next
    })
  }

  // Live "now" ticker for scheduled-deed countdowns (1s cadence).
  const countdownNow = useCountdown()

  const currentDate = useMemo(() => parseISO(dateStr), [dateStr])
  const activeCategories = getFlatItems().filter(i => i.layer === 1)

  const findItem = useCallback((id: string): Item | undefined => {
    const search = (nodes: Item[]): Item | undefined => {
      for (const n of nodes) {
        if (n.id === id) return n
        if (n.children) { const f = search(n.children); if (f) return f }
      }
      return undefined
    }
    return search(items)
  }, [items])

  const dailyGoals = useMemo<Item[]>(() => {
    const seen = new Set<string>()
    const result: Item[] = []
    const search = (nodes: Item[]) => {
      nodes.forEach(n => {
        if (n.layer === 6 && n.startDate) {
          const goalDateStr = typeof n.startDate === 'string'
            ? n.startDate.substring(0, 10)
            : new Date(n.startDate).toISOString().substring(0, 10)
          if (goalDateStr === dateStr && !seen.has(n.id)) {
            seen.add(n.id)
            result.push(n)
          }
        }
        if (n.children) search(n.children)
      })
    }
    search(items)
    return result
  }, [items, dateStr])
  const primaryGoal: Item | undefined = dailyGoals[0]

  const loadDayNotes = useCallback(async (): Promise<DayNote[] | null> => {
    try {
      const noteRes = await fetch(`/api/notes?date=${dateStr}`)
      if (!noteRes.ok) return null
      const data = await noteRes.json()
      return data.notes || []
    } catch (e) {
      console.error('Failed to fetch notes', e)
      return null
    }
  }, [dateStr])
  const fetchDayNotes = useCallback(async () => {
    const notes = await loadDayNotes()
    if (notes) setDayNotes(notes)
  }, [loadDayNotes])

  useEffect(() => {
    let cancelled = false
    loadDayNotes().then(n => { if (!cancelled && n) setDayNotes(n) })
    return () => { cancelled = true }
  }, [loadDayNotes])

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/items')
      const data = await res.json()
      if (data.items) {
        const itemMap = new Map<string, Item>()
        ;(data.items as Item[]).forEach(item => itemMap.set(item.id, { ...item, children: [], tasks: item.tasks || [] }))
        const tree: Item[] = []
        ;(data.items as Item[]).forEach(item => {
          const node = itemMap.get(item.id)!
          if (item.parentId) {
            const parent = itemMap.get(item.parentId)
            if (parent) parent.children!.push(node)
          } else {
            tree.push(node)
          }
        })
        setItems(tree)
      }
    } catch (e) {
      console.error('Failed to fetch items', e)
    } finally {
      setLoading(false)
    }
  }, [setItems])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const allTasks: Task[] = useMemo(() => {
    const tasks: Task[] = []
    const searchTasks = (nodes: Item[]) => {
      nodes.forEach(n => {
        if (n.tasks) {
          n.tasks.forEach(t => {
            const tDate = new Date(t.date).toISOString().substring(0, 10)
            if (tDate === dateStr && !tasks.some(existing => existing.id === t.id)) {
              tasks.push(t)
            }
          })
        }
        if (n.children) searchTasks(n.children)
      })
    }
    searchTasks(items)
    return dedupeTasks(tasks).map(t => (retimed[t.id] ? { ...t, ...retimed[t.id] } : t))
  }, [items, dateStr, retimed])

  // Progress for each day of the week strip (from the loaded hierarchy).
  const weekProgress = useMemo(() => {
    const map: Record<string, { done: number; total: number }> = {}
    const seen = new Set<string>()
    const walk = (nodes: Item[]) => nodes.forEach(n => {
      n.tasks?.forEach(t => {
        if (seen.has(t.id)) return
        seen.add(t.id)
        const k = new Date(t.date).toISOString().substring(0, 10)
        const e = (map[k] ??= { done: 0, total: 0 })
        e.total++
        if (t.completed) e.done++
      })
      if (n.children) walk(n.children)
    })
    walk(items)
    return map
  }, [items])
  const visibleGoogleEvents = useMemo(() => withoutDeedMirrors(googleEvents, allTasks), [googleEvents, allTasks])
  const scheduleEvents: ScheduleEvent[] = useMemo(() => [
    ...(showGoogle ? visibleGoogleEvents.map(e => ({ id: e.id, title: e.title, startTime: e.startTime, endTime: e.endTime, source: 'google' as const })) : []),
    ...localEvents,
  ], [showGoogle, visibleGoogleEvents, localEvents])
  const scheduledTasks = useMemo(() => allTasks.filter(t => t.startTime && t.endTime), [allTasks])
  const unscheduledTasks = allTasks.filter(t => !t.startTime && !t.isHabit)
  const frogTasks = allTasks.filter(t => t.isFrog).sort((a, b) => {
    if (a.startTime && b.startTime) return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    if (a.startTime) return -1
    if (b.startTime) return 1
    return a.title.localeCompare(b.title)
  })
  const habitTasks = allTasks.filter(t => t.isHabit)
  // Habits rendered in the tracker = fetched per-day habits, else store fallback
  const displayedHabits = todayHabits.length > 0 ? todayHabits : habitTasks
  // Habits the user owns that fall outside today's schedule. They stay visible as
  // read-only rows (with their next due date) so no habit ever vanishes from the
  // tracker — the counters above still measure only what is actually due today.
  const scheduledHabitTitles = new Set(displayedHabits.map(h => h.title))
  const offDayHabits = habitOverview.filter(h => !h.scheduled && !scheduledHabitTitles.has(h.title))
  // Day score counts every task for the day, including habits
  const deedTasks = allTasks
  const completedTasks = deedTasks.filter(t => t.completed)
  const totalWeight = deedTasks.reduce((sum, t) => sum + t.weight, 0)
  const earnedPoints = deedTasks.reduce((sum, t) => sum + (t.completed ? t.weight : 0), 0)
  const dayScore = totalWeight > 0
    ? deedTasks.reduce((sum, t) => sum + (t.completed ? t.weight : 0), 0) / totalWeight * 100
    : 0

  // Soonest upcoming/live scheduled deed — surfaces a subtle "next up" ticker.
  const nextScheduledDeed = useMemo(() => {
    const candidates = scheduledTasks
      .filter(t => !t.completed && t.startTime)
      .map(t => ({
        task: t,
        parts: formatCountdown(countdownNow, new Date(t.startTime!), t.endTime ? new Date(t.endTime) : null),
      }))
      .sort((a, b) => a.parts.totalSeconds - b.parts.totalSeconds)
    return candidates[0] || null
  }, [scheduledTasks, countdownNow])

  // Celebrate a perfect day — confetti + haptic, once per date
  const prevScoreRef = useRef(dayScore)
  useEffect(() => {
    let already = false
    try { already = window.localStorage.getItem(`inchstone-celebrated-${dateStr}`) === '1' } catch { /* storage unavailable */ }
    if (!already && prevScoreRef.current < 100 && dayScore >= 100 && deedTasks.length >= 3) {
      import('@/components/ui/Confetti').then(m => m.fireConfetti())
      navigator.vibrate?.(35)
      try { window.localStorage.setItem(`inchstone-celebrated-${dateStr}`, '1') } catch { /* storage unavailable */ }
    }
    prevScoreRef.current = dayScore
  }, [dayScore, deedTasks.length, dateStr])

  // ── Deed actions (shared by the hour grid, agenda, table and cards) ────
  const handleToggleTask = (task: Task) => {
    const goalItem = findItem(task.goalId)
    if (!goalItem) return

    // Toggle locally first
    const updatedTasks = (goalItem.tasks || []).map(t =>
      t.id === task.id ? { ...t, completed: !t.completed } : t
    )
    const updateNode = (nodes: Item[]): Item[] => nodes.map(n => {
      if (n.id === goalItem.id) return { ...n, tasks: updatedTasks }
      if (n.children) return { ...n, children: updateNode(n.children) }
      return n
    })
    setItems(updateNode(items))

    // Persist to backend (no store updateTask to avoid double PUT)
    fetch(`/api/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !task.completed }),
    }).then(() => fetchHabitHistory())
  }

  const handleOpenDeed = (task: Task) => {
    const goalItem = findItem(task.goalId)
    const parentWeekly = goalItem?.parentId ? findItem(goalItem.parentId) : null
    setSelectedDeed({ task, parentGoal: parentWeekly || null })
    setDeedReflection(task.reflection || '')
  }

  // Persist the sheet's edits. Only fields that actually changed are sent, so a
  // tweak to one thing (say the colour) can never overwrite another day's time
  // or points. Repeating deeds/habits ask "just this / this and following / all"
  // first; everything else saves straight away.
  const commitDeedSave = async (
    taskId: string,
    changes: Record<string, unknown>,
    scope: DeleteScope,
    becameRecurring: boolean,
  ) => {
    if (savingEditRef.current) return
    savingEditRef.current = true
    setPendingEdit(null)
    try {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...changes, reflection: deedReflection, scope }),
      })
      if (!res.ok) {
        console.error('Save failed:', await res.text())
        showToast('Could not save changes', 'error')
        return
      }
    } catch (e) {
      console.error('Failed to save task changes:', e)
      showToast('Network error', 'error')
      return
    }

    setSelectedDeed(null)
    await Promise.all([fetchItems(), fetchTodayHabits(), fetchHabitHistory()])
    showToast(
      becameRecurring ? 'Now repeating — upcoming days created'
        : scope === 'all' ? 'Updated the whole series'
        : scope === 'future' ? 'Updated this and following days'
        : 'Changes saved',
      'success',
    )
    } finally {
      savingEditRef.current = false
    }
  }

  const handleSaveDeedChanges = async () => {
    if (!selectedDeed) return
    const task = selectedDeed.task
    const goalItem = findItem(task.goalId)
    if (!goalItem) return
    const original = (goalItem.tasks || []).find(t => t.id === task.id)

    const changes: Record<string, unknown> = {}
    const labels: string[] = []
    const track = (label: string, keys: (keyof Task)[], build: () => Record<string, unknown>) => {
      if (original && !keys.some(k => original[k] !== task[k])) return
      Object.assign(changes, build())
      labels.push(label)
    }
    track('Title', ['title'], () => ({ title: task.title }))
    track('Time', ['startTime', 'endTime'], () => ({ startTime: task.startTime, endTime: task.endTime }))
    track('Points', ['weight'], () => ({ weight: task.weight }))
    track('Category', ['categoryId'], () => ({ categoryId: task.categoryId }))
    track('Repeat', ['isRecurring', 'recurrencePattern'], () => ({ isRecurring: task.isRecurring, recurrencePattern: task.recurrencePattern }))
    track('Frog', ['isFrog'], () => ({ isFrog: task.isFrog }))
    track('Habit', ['isHabit'], () => ({ isHabit: task.isHabit }))
    track('Reminder', ['isImportant', 'reminderMinutes'], () => ({
      isImportant: task.isImportant,
      reminderMinutes: task.isImportant ? (task.reminderMinutes ?? 10) : null,
    }))
    track('Alerts', ['notifyDeed', 'endWarnMinutes'], () => ({
      notifyDeed: !!task.notifyDeed,
      endWarnMinutes: task.notifyDeed ? (task.endWarnMinutes ?? 10) : null,
    }))
    track('Color', ['color'], () => ({ color: task.color }))
    // Progress belongs to the day it was logged on — never part of a series edit.
    if (!original || original.progress !== task.progress) changes.progress = task.progress

    const becameRecurring = !!original && !original.isRecurring && !!task.isRecurring
    const isSeries = !!original && (original.isRecurring || original.isHabit)
    if (isSeries && labels.length > 0) {
      setPendingEdit({ taskId: task.id, changes, becameRecurring, target: { title: task.title, isHabit: !!task.isHabit, changes: labels } })
      return
    }
    await commitDeedSave(task.id, changes, 'single', becameRecurring)
  }

  const handleToggleSelectedComplete = () => {
    if (!selectedDeed) return
    const task = selectedDeed.task
    const goalItem = findItem(task.goalId)
    if (!goalItem) return
    const nextCompleted = !task.completed
    updateTask(goalItem.id, task.id, { completed: nextCompleted })
    setSelectedDeed({ ...selectedDeed, task: { ...task, completed: nextCompleted } })
    fetch(`/api/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: nextCompleted }),
    }).then(() => fetchHabitHistory())
  }

  const performDeleteTask = async (taskId: string, scope: DeleteScope = 'single') => {
    setDeleteScopeTarget(null)
    try {
      const res = await fetch(`/api/tasks/${taskId}?scope=${scope}`, { method: 'DELETE' })
      if (!res.ok) {
        showToast('Failed to delete', 'error')
      } else {
        fetchItems()
        fetchTodayHabits()
        fetchHabitHistory()
        showToast(scope === 'single' ? 'Deleted' : 'Deleted from the series', 'success')
      }
    } catch (e) {
      console.error(e)
      showToast('Network error', 'error')
    }
  }

  const handleDeleteTask = async (e: StopEvent, taskId: string) => {
    e.stopPropagation()
    const task = allTasks.find(t => t.id === taskId)

    // Not part of the day currently on screen — fall back to a plain confirm
    // rather than guessing at a series.
    if (!task) {
      if (!(await confirm('Delete this deed?'))) return
      await performDeleteTask(taskId, 'single')
      return
    }

    // A one-shot deed is a single row — a plain confirm is enough. Anything
    // that repeats (recurring deed or habit) needs a scope: this occurrence,
    // this and all future ones, or the whole series.
    if (!task.isRecurring && !task.isHabit) {
      if (!(await confirm('Delete this deed?'))) return
      await performDeleteTask(taskId, 'single')
      return
    }

    setDeleteScopeTarget({ taskId, title: task.title, isHabit: !!task.isHabit })
  }

  const handleUpdateTaskField = async (task: Task, field: 'weight' | 'progress', value: number) => {
    const goalItem = findItem(task.goalId)
    if (!goalItem) return
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      updateTask(goalItem.id, task.id, { [field]: value })
    } catch (e) {
      console.error(e)
    }
  }
  const handleWeightChange = (task: Task, weight: number) => { void handleUpdateTaskField(task, 'weight', weight) }

  // ── Add deed ──────────────────────────────────────────────────────────
  const openAddDeed = (start = '', end = '') => {
    setAddPrefill({ start, end })
    setAddingDeed(true)
  }

  const suggestedWeight = (): string => String(DEFAULT_POINTS)

  /** Add a deed on any day: the same flow the form uses (find or create that day, then the task). */
  const addDeedOn = async (target: string, v: NewDeedValues): Promise<boolean> => {
    if (!v.title.trim() || savingDeed) return false
    const targetDate = parseISO(target)
    const goalsForTarget = target === dateStr ? dailyGoals : getFlatItems().filter(i => i.layer === 6 && i.startDate && (typeof i.startDate === 'string' ? i.startDate.substring(0, 10) : new Date(i.startDate).toISOString().substring(0, 10)) === target)
    setSavingDeed(true)
    try {
      let goalId: string
      if (goalsForTarget.length > 0) {
        goalId = goalsForTarget[0].id
      } else {
        let parentWeekId: string | undefined
        const searchForWeek = (nodes: Item[]) => {
          for (const n of nodes) {
            if (n.layer === 5 && n.startDate && n.endDate) {
              const ws = new Date(n.startDate).getTime()
              const we = new Date(n.endDate).getTime()
              const cd = targetDate.getTime()
              if (cd >= ws && cd <= we) {
                parentWeekId = n.id
                return
              }
            }
            if (n.children) searchForWeek(n.children)
          }
        }
        searchForWeek(items)
        const createRes = await fetch('/api/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            layer: 6,
            parentId: parentWeekId || null,
            title: format(targetDate, 'EEEE'),
            weight: 14.3,
            startDate: target,
            endDate: target,
          })
        })
        const createData = await createRes.json()
        if (!createData.item?.id) {
          showToast('Could not create a daily goal for this date.', 'error')
          return false
        }
        goalId = createData.item.id
        await fetchItems()
      }

      const startTimeISO = v.start ? new Date(`${target}T${v.start}:00`).toISOString() : null
      const endTimeISO = v.end ? new Date(`${target}T${v.end}:00`).toISOString() : null
      const parsedPoints = parseFloat(v.points)
      const finalWeight = parsedPoints > 0 ? parsedPoints : DEFAULT_POINTS

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalId,
          title: v.title.trim(),
          date: target,
          startTime: startTimeISO,
          endTime: endTimeISO,
          weight: finalWeight,
          categoryId: v.categoryId || null,
          isRecurring: v.isRecurring,
          recurrencePattern: v.isRecurring ? v.recurrencePattern : null,
          recurrenceEnd: v.isRecurring && v.recurrenceEnd ? new Date(v.recurrenceEnd).toISOString() : null,
          color: v.color || null,
          isFrog: v.isFrog,
          isHabit: v.isHabit,
          isImportant: v.isImportant,
          reminderMinutes: v.isImportant ? (parseInt(v.reminder, 10) || 0) : null,
          notifyDeed: v.notify && !!v.start,
          endWarnMinutes: v.notify && !!v.start ? (parseInt(v.endWarn, 10) || 10) : null,
        })
      })
      const resData = await res.json()
      if (!res.ok) {
        showToast(`Failed to save task: ${resData.error || 'Unknown error'}`, 'error')
        return false
      }
      fetchItems()
      fetchHabitHistory()
      showToast(v.isHabit ? 'Habit added for every day going forward' : 'Deed added', 'success')
      setAddingDeed(false)
      return true
    } catch (e) {
      console.error('Error adding deed:', e)
      showToast('An error occurred while saving the task.', 'error')
      return false
    } finally {
      setSavingDeed(false)
    }
  }

  const handleAddDeed = (v: NewDeedValues) => addDeedOn(dateStr, v)

  // ── Schedule v2 actions ───────────────────────────────────────────────
  const isTodayPage = dateStr === format(new Date(), 'yyyy-MM-dd')
  const toIso = (m: number) => new Date(`${dateStr}T${hhmm(m)}:00`).toISOString()
  const blankDeed = (title: string, start: string, end: string): NewDeedValues => ({
    title, start, end, categoryId: '', isRecurring: false, recurrencePattern: 'daily', recurrenceEnd: '',
    isFrog: false, isHabit: false, isImportant: false, reminder: '10', notify: true, endWarn: '10',
    points: String(DEFAULT_POINTS), color: '',
  })

  /** Drag/resize or a planner placed a deed: save its new times for this day only. */
  const retimeTask = async (task: Task, start: number, end: number, quiet = false) => {
    const startTime = toIso(start), endTime = toIso(Math.min(end, 24 * 60 - 1))
    setRetimed(r => ({ ...r, [task.id]: { startTime, endTime } }))
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startTime, endTime, scope: 'single' }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not move it')
      await fetchItems()
      if (!quiet) showToast(`"${task.title}" now ${format(new Date(startTime), 'h:mm a')}${task.isRecurring || task.isHabit ? ' (this day only)' : ''}`, 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not move it', 'error')
    } finally {
      setRetimed(r => { const n = { ...r }; delete n[task.id]; return n })
    }
  }

  const busySpans = () => [
    ...allTasks.filter(t => t.startTime && t.endTime).map(t => {
      const s = new Date(t.startTime!), e = new Date(t.endTime!)
      return { start: s.getHours() * 60 + s.getMinutes(), end: e.getHours() * 60 + e.getMinutes() }
    }),
    ...scheduleEvents.map(ev => {
      const s = new Date(ev.startTime), e = new Date(ev.endTime)
      return { start: s.getHours() * 60 + s.getMinutes(), end: e.getHours() * 60 + e.getMinutes() }
    }),
  ]
  const planFrom = () => {
    const now = new Date()
    const nowMin = now.getHours() * 60 + now.getMinutes()
    return isTodayPage ? Math.max(6 * 60, Math.ceil((nowMin + 10) / 15) * 15) : 8 * 60
  }

  const findSlot = async (task: Task) => {
    const len = task.estimatedDuration || 60
    const gap = freeGaps(busySpans(), planFrom(), 22 * 60, len, 5)[0]
    if (!gap) { showToast('No free slot left today for that', 'error'); return }
    const start = Math.ceil(gap.start / 15) * 15
    await retimeTask(task, start, start + len)
  }

  const autoPlanDay = async () => {
    const todo = unscheduledTasks.filter(t => !t.completed).map(t => ({
      id: t.id, minutes: t.estimatedDuration || 60,
      rank: (t.isFrog ? 0 : 10) + (t.priority === 'high' ? 0 : t.priority === 'low' ? 3 : 1),
    }))
    const placed = autoPlan(todo, busySpans(), planFrom(), 22 * 60)
    if (!placed.length) { showToast('No free time left to plan into today', 'error'); return }
    setPlanning(true)
    for (const p of placed) {
      const t = allTasks.find(x => x.id === p.id)
      if (t) await retimeTask(t, p.start, p.end, true)
    }
    setPlanning(false)
    const left = todo.length - placed.length
    showToast(`Planned ${placed.length} task${placed.length === 1 ? '' : 's'} into your free time${left ? `; ${left} did not fit` : ''}`, 'success')
  }

  const createEvent = async (title: string, start: string, end: string, onDate = dateStr) => {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, startTime: new Date(`${onDate}T${start}:00`).toISOString(), endTime: new Date(`${onDate}T${end}:00`).toISOString(), type: 'event' }),
    })
    if (!res.ok) { showToast('Could not add the event', 'error'); return false }
    showToast(`Event "${title}" added`, 'success')
    await loadLocalEvents()
    return true
  }

  const deleteEvent = async (ev: ScheduleEvent) => {
    if (!(await confirm(`Delete the event "${ev.title}"?`))) return
    const res = await fetch('/api/events', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ev.id }) })
    if (!res.ok) { showToast('Could not delete the event', 'error'); return }
    setOpenEvent(null)
    await loadLocalEvents()
  }

  const submitQuick = async (v: QuickCreateValues) => {
    const ok = v.kind === 'event'
      ? await createEvent(v.title, hhmm(v.start), hhmm(v.end))
      : await handleAddDeed({ ...blankDeed(v.title, hhmm(v.start), hhmm(v.end)), isFrog: v.frog, isImportant: v.important })
    if (ok) setQuick(null)
  }

  const submitMagic = async (q: QuickAdd): Promise<boolean> => {
    const target = q.dayOffset ? format(addDays(currentDate, q.dayOffset), 'yyyy-MM-dd') : dateStr
    if (q.kind === 'event') {
      if (!q.start || !q.end) { showToast('Give the event a time, e.g. "Lunch 1-2pm #event"', 'error'); return false }
      return createEvent(q.title, q.start, q.end, target)
    }
    const ok = await addDeedOn(target, {
      ...blankDeed(q.title, q.start ?? '', q.end ?? ''),
      isFrog: q.frog, isImportant: q.important, isHabit: q.habit,
      isRecurring: !!q.repeat && !q.habit, recurrencePattern: q.repeat ?? 'daily',
    })
    if (ok && target !== dateStr) showToast(`Added to ${format(parseISO(target), 'EEEE d MMM')}`, 'success')
    return ok
  }

  // Keyboard: ← → move a day, T jumps to today (N focuses magic add, in MagicAdd).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.metaKey || e.ctrlKey || e.altKey || el.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return
      if (e.key === 'ArrowLeft') router.push(`/day/${format(addDays(currentDate, -1), 'yyyy-MM-dd')}`)
      else if (e.key === 'ArrowRight') router.push(`/day/${format(addDays(currentDate, 1), 'yyyy-MM-dd')}`)
      else if (e.key === 't' || e.key === 'T') router.push(`/day/${format(new Date(), 'yyyy-MM-dd')}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentDate, router])

  // ── Habit actions ─────────────────────────────────────────────────────
  // Dedicated quick-add for habits — bypasses the complex handleAddDeed flow
  const handleQuickAddHabit = async (title: string, pattern: string = 'daily') => {
    try {
      const res = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, recurrencePattern: pattern })
      })
      if (res.ok) {
        showToast(`"${title}" habit added!`, 'success')
        fetchTodayHabits()
        fetchHabitHistory()
        fetchItems()
        fetchHabitOverview()
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to add habit', 'error')
      }
    } catch (e) {
      console.error(e)
      showToast('Network error', 'error')
    }
  }

  const handleToggleHabit = async (task: Task) => {
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !task.completed }),
    })
    setTodayHabits(prev => prev.map(h => (h.id === task.id ? { ...h, completed: !h.completed } : h)))
    fetchHabitHistory()
  }

  const handleRenameHabit = async (oldTitle: string, newTitle: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/habits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldTitle, newTitle }),
      })
      if (res.ok) {
        showToast('Habit renamed — all instances updated', 'success')
        await Promise.all([fetchItems(), fetchTodayHabits(), fetchHabitHistory(), fetchHabitOverview()])
        return true
      }
      const data = await res.json()
      showToast(data.error || 'Failed to rename habit', 'error')
    } catch (e) {
      console.error(e)
      showToast('Network error', 'error')
    }
    return false
  }

  if (loading) return <Loader label="Spinning the day slots…" routeKey="day" />

  const tabBtn = (active: boolean) =>
    `px-3.5 py-2 sm:py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${active ? 'bg-gold text-ink shadow-md' : 'text-parchment/60 hover:text-gold hover:bg-gold/[0.06]'}`
  const pillBtn = 'flex items-center gap-1.5 rounded-xl border px-3 py-2 sm:py-1.5 text-xs font-bold transition'

  return (
    <div className="space-y-5 sm:space-y-6 max-w-full pb-12 stagger-children mx-auto 2xl:max-w-[1600px]">
      <DayHero
        date={currentDate}
        score={dayScore}
        done={completedTasks.length}
        total={deedTasks.length}
        points={earnedPoints}
        totalPoints={totalWeight}
        week={weekProgress}
        onGo={d => router.push(`/day/${format(d, 'yyyy-MM-dd')}`)}
        onToday={() => router.push(`/day/${format(new Date(), 'yyyy-MM-dd')}`)}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 space-y-6">
          <MagicAdd onSubmit={submitMagic} busy={savingDeed} />

          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-xl border border-gold/15 bg-surface-solid p-1">
                <button onClick={() => setViewMode('timeline')} aria-pressed={viewMode === 'timeline'} className={tabBtn(viewMode === 'timeline')}>
                  <Clock className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />Schedule
                </button>
                <button onClick={() => setViewMode('table')} aria-pressed={viewMode === 'table'} className={tabBtn(viewMode === 'table')}>
                  <Target className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />List
                </button>
              </div>
              {nextScheduledDeed && (
                <span className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-gold tabular-nums animate-fadeIn">
                  <Activity className="w-3 h-3" />
                  next · {nextScheduledDeed.task.title.slice(0, 22)} · {compactCountdownLabel(nextScheduledDeed.parts)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {googleConnected ? (
                <button onClick={toggleGoogle} aria-pressed={showGoogle}
                  title={showGoogle ? 'Hide Google Calendar events' : 'Show Google Calendar events'}
                  className={`${pillBtn} ${showGoogle ? 'border-gold/25 bg-gold/10 text-gold hover:bg-gold/20' : 'border-gold/15 text-parchment/45 hover:text-gold'}`}>
                  <Calendar className="w-3.5 h-3.5" /> Google
                  {showGoogle && visibleGoogleEvents.length > 0 && (
                    <span className="rounded-full bg-gold/20 px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums leading-none">{visibleGoogleEvents.length}</span>
                  )}
                </button>
              ) : (
                <a href="/settings" title="Connect Google Calendar to see your events here"
                  className={`${pillBtn} border-gold/15 text-parchment/50 hover:text-gold`}>
                  <Calendar className="w-3.5 h-3.5" /> Google <Plus className="w-3 h-3" />
                </a>
              )}
              <button onClick={() => (addingDeed ? setAddingDeed(false) : openAddDeed())}
                className={`${pillBtn} ${addingDeed ? 'border-ember/30 text-ember' : 'border-gold/15 text-parchment/60 hover:text-gold'}`}>
                {addingDeed ? <X className="w-3.5 h-3.5" /> : <SlidersHorizontal className="w-3.5 h-3.5" />}
                {addingDeed ? 'Close' : 'Full form'}
              </button>
            </div>
          </div>

          {addingDeed && (
            <div className="rounded-2xl border border-gold/15 bg-surface-solid p-4 sm:p-5">
              <AddDeedForm
                initialStart={addPrefill.start}
                initialEnd={addPrefill.end}
                initialWeight={suggestedWeight()}
                dayTotalPoints={totalWeight}
                categories={activeCategories}
                saving={savingDeed}
                onCancel={() => setAddingDeed(false)}
                onSubmit={handleAddDeed}
              />
            </div>
          )}

          {quick && (
            <QuickCreate
              start={quick.start}
              end={quick.end}
              busy={savingDeed}
              onChange={(a, b) => setQuick({ start: a, end: b })}
              onSubmit={submitQuick}
              onMore={() => { openAddDeed(hhmm(quick.start), hhmm(quick.end)); setQuick(null) }}
              onClose={() => setQuick(null)}
            />
          )}
          {openEvent && (
            <EventCard ev={openEvent} onClose={() => setOpenEvent(null)}
              onDelete={openEvent.source === 'inchstone' ? () => { void deleteEvent(openEvent) } : undefined} />
          )}

          {viewMode === 'timeline' ? (
            <>
              <TasksLane
                tasks={unscheduledTasks}
                busy={planning}
                onToggle={handleToggleTask}
                onOpen={handleOpenDeed}
                onSchedule={t => { void findSlot(t) }}
                onAutoPlan={() => { void autoPlanDay() }}
              />
              <DaySchedule
                tasks={allTasks.filter(t => !t.isHabit || t.startTime)}
                events={scheduleEvents}
                isToday={isTodayPage}
                nowMs={countdownNow.getTime()}
                pending={quick}
                onCreate={(a, b) => { setOpenEvent(null); setQuick({ start: a, end: b }) }}
                onRetime={(t, a, b) => { void retimeTask(t, a, b) }}
                onOpenTask={handleOpenDeed}
                onOpenEvent={ev => { setQuick(null); setOpenEvent(ev) }}
                onToggle={handleToggleTask}
              />
              <p className="px-1 text-caption text-parchment/40">
                Click or drag on empty time to add · drag a deed to move it, its bottom edge to resize · ← → change day · N to type
              </p>
            </>
          ) : (
            <DeedTable
              totalPoints={totalWeight}
              allTasks={allTasks}
              googleEvents={visibleGoogleEvents}
              showGoogle={showGoogle}
              countdownNow={countdownNow}
              onOpen={handleOpenDeed}
              onToggle={handleToggleTask}
              onDelete={handleDeleteTask}
              onWeightChange={handleWeightChange}
            />
          )}
        </div>

        <div className="space-y-6">
          <FrogCard
            frogTasks={frogTasks}
            onAdd={() => openAddDeed()}
            onToggle={handleToggleTask}
            onDelete={handleDeleteTask}
          />

          <ReflectionCard
            key={primaryGoal?.id ?? 'no-goal'}
            dateStr={dateStr}
            goalId={primaryGoal?.id ?? null}
            initialText={primaryGoal?.reflection ?? ''}
            onSave={text => { if (primaryGoal) updateItem(primaryGoal.id, { reflection: text }) }}
            onTemplateSaved={() => showToast('Reflection template saved', 'success')}
          />

          {/* Done views — by hour and by challenge */}
          <DoneView
            tasks={allTasks}
            onDeleteTask={id => void handleDeleteTask({ stopPropagation: () => {} }, id)}
            className="mb-6"
          />

          <DayNotesCard
            notes={dayNotes}
            onAdd={() => { setEditingNote(null); setShowNoteModal(true) }}
            onEdit={note => { setEditingNote(note); setShowNoteModal(true) }}
          />

          <GoalCards
            primaryGoal={primaryGoal}
            dailyGoals={dailyGoals}
            completionMap={completionMap}
            findItem={findItem}
          />
        </div>
      </div>

      <HabitTracker
        displayedHabits={displayedHabits}
        offDayHabits={offDayHabits}
        hasOverview={habitOverview.length > 0}
        habitDetail={habitDetail}
        habitSeriesByTitle={habitSeriesByTitle}
        habitHistory={habitHistory}
        range={habitGraphRange}
        customStart={habitGraphCustomStart}
        customEnd={habitGraphCustomEnd}
        onRangeChange={setHabitGraphRange}
        onCustomStart={setHabitGraphCustomStart}
        onCustomEnd={setHabitGraphCustomEnd}
        onApplyCustom={() => { void fetchHabitHistory() }}
        onQuickAdd={handleQuickAddHabit}
        onToggleHabit={handleToggleHabit}
        onDelete={handleDeleteTask}
        onRename={handleRenameHabit}
      />

      {showNoteModal && (
        <RichNoteModal
          onClose={() => { setShowNoteModal(false); setEditingNote(null) }}
          onSaved={() => { fetchDayNotes(); fetchItems() }}
          note={editingNote}
          defaultDate={dateStr}
        />
      )}

      <AnimatePresence>
        {selectedDeed && (
          <DeedDetailModal
            totalPoints={totalWeight}
            key="deed-detail"
            selectedDeed={selectedDeed}
            currentDate={currentDate}
            categories={activeCategories}
            completionMap={completionMap}
            countdownNow={countdownNow}
            reflection={deedReflection}
            onReflectionChange={setDeedReflection}
            onChange={setSelectedDeed}
            onToggleComplete={handleToggleSelectedComplete}
            onSave={handleSaveDeedChanges}
            onClose={() => setSelectedDeed(null)}
            onDelete={async (e, id) => {
              await handleDeleteTask(e, id)
              setSelectedDeed(null)
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteScopeTarget && (
          <DeleteScopeDialog
            key="delete-scope"
            target={deleteScopeTarget}
            onDelete={scope => { void performDeleteTask(deleteScopeTarget.taskId, scope) }}
            onClose={() => setDeleteScopeTarget(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingEdit && (
          <EditScopeDialog
            key="edit-scope"
            target={pendingEdit.target}
            onChoose={scope => { void commitDeedSave(pendingEdit.taskId, pendingEdit.changes, scope, pendingEdit.becameRecurring) }}
            onClose={() => setPendingEdit(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
