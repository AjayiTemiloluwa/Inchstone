'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useHierarchyStore, Item, Task } from '@/stores/hierarchyStore'
import { Card } from '@/components/ui/Card'
import { useRouter, useParams } from 'next/navigation'
import { ChevronRight, Plus, X, Clock, Target, Activity, Calendar } from 'lucide-react'
import { format, parseISO, addDays } from 'date-fns'
import { AnimatePresence } from 'motion/react'
import { Scramble } from '@/components/ui/motion'
import dynamic from 'next/dynamic'
import { useCountdown, formatCountdown, compactCountdownLabel } from '@/lib/useCountdown'
import { useToast } from '@/components/ui/ToastProvider'
import { DoneView } from '@/components/ui/DoneView'
import { Loader } from '@/components/ui/Loader'
import { AddDeedForm } from '@/components/day/AddDeedForm'
import { DayHeader } from '@/components/day/DayHeader'
import { DayNotesCard } from '@/components/day/DayNotesCard'
import { DeedAgenda } from '@/components/day/DeedAgenda'
import { DeedDetailModal } from '@/components/day/DeedDetailModal'
import { DeedTable } from '@/components/day/DeedTable'
import { DeedTimeline } from '@/components/day/DeedTimeline'
import { DeleteScopeDialog, type DeleteScopeTarget } from '@/components/day/DeleteScopeDialog'
import { EditScopeDialog, type EditScopeTarget } from '@/components/day/EditScopeDialog'
import { FrogCard } from '@/components/day/FrogCard'
import { GoalCards } from '@/components/day/GoalCards'
import { HabitTracker } from '@/components/day/HabitTracker'
import { ReflectionCard } from '@/components/day/ReflectionCard'
import { UnscheduledDeeds } from '@/components/day/UnscheduledDeeds'
import { useHabitData } from '@/components/day/useHabitData'
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
    return dedupeTasks(tasks)
  }, [items, dateStr])
  const visibleGoogleEvents = useMemo(() => withoutDeedMirrors(googleEvents, allTasks), [googleEvents, allTasks])
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

  const goToDay = (offset: number) => {
    router.push(`/day/${format(addDays(currentDate, offset), 'yyyy-MM-dd')}`)
  }

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
  const handleProgressChange = (task: Task, progress: number) => { void handleUpdateTaskField(task, 'progress', progress) }

  // ── Add deed ──────────────────────────────────────────────────────────
  const openAddDeed = (start = '', end = '') => {
    setAddPrefill({ start, end })
    setAddingDeed(true)
  }

  const suggestedWeight = (): string => String(DEFAULT_POINTS)

  const handleAddDeed = async (v: NewDeedValues): Promise<boolean> => {
    if (!v.title.trim() || savingDeed) return false
    setSavingDeed(true)
    try {
      let goalId: string
      if (dailyGoals.length > 0) {
        goalId = dailyGoals[0].id
      } else {
        let parentWeekId: string | undefined
        const searchForWeek = (nodes: Item[]) => {
          for (const n of nodes) {
            if (n.layer === 5 && n.startDate && n.endDate) {
              const ws = new Date(n.startDate).getTime()
              const we = new Date(n.endDate).getTime()
              const cd = currentDate.getTime()
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
            title: format(currentDate, 'EEEE'),
            weight: 14.3,
            startDate: dateStr,
            endDate: dateStr,
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

      const startTimeISO = v.start ? new Date(`${dateStr}T${v.start}:00`).toISOString() : null
      const endTimeISO = v.end ? new Date(`${dateStr}T${v.end}:00`).toISOString() : null
      const parsedPoints = parseFloat(v.points)
      const finalWeight = parsedPoints > 0 ? parsedPoints : DEFAULT_POINTS

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalId,
          title: v.title.trim(),
          date: dateStr,
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
    `px-3.5 py-2 sm:py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${active ? 'bg-gold text-ink shadow-md' : 'text-ink/60 hover:text-gold hover:bg-white/5'}`
  const pillBtn = 'flex items-center gap-1.5 rounded-xl border px-3 py-2 sm:py-1.5 text-xs font-bold transition'

  return (
    <div className="space-y-5 sm:space-y-6 max-w-full pb-12 stagger-children mx-auto 2xl:max-w-[1600px]">
      <div className="flex items-center space-x-2 text-sm text-ink/50 flex-wrap">
        <button onClick={() => router.push('/year')} className="hover:text-gold transition">Year</button>
        <ChevronRight className="w-3 h-3" />
        <span className="text-ink font-bold">{format(currentDate, 'EEEE, MMMM d, yyyy')}</span>
      </div>

      <DayHeader
        currentDate={currentDate}
        completed={completedTasks.length}
        earnedPoints={earnedPoints}
        totalPoints={totalWeight}
        total={deedTasks.length}
        dayScore={dayScore}
        onPrev={() => goToDay(-1)}
        onNext={() => goToDay(1)}
        onToday={() => router.push(`/day/${format(new Date(), 'yyyy-MM-dd')}`)}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 space-y-6">
          <Card className="p-4 sm:p-5 space-y-4 rounded-2xl">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gold" />
                <h2 className="text-lg sm:text-xl font-display font-bold text-ink"><Scramble text="Deeds" mono={false} /></h2>
                <span className="text-xs font-mono text-ink/40">{completedTasks.length}/{deedTasks.length}</span>
                {nextScheduledDeed && (
                  <span className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-gold tabular-nums animate-fadeIn">
                    <Activity className="w-3 h-3" />
                    next up · {compactCountdownLabel(nextScheduledDeed.parts)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex rounded-2xl border border-white/10 bg-black/20 p-1 backdrop-blur">
                  <button onClick={() => setViewMode('timeline')} className={tabBtn(viewMode === 'timeline')}>
                    <Clock className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />Timeline
                  </button>
                  <button onClick={() => setViewMode('table')} className={tabBtn(viewMode === 'table')}>
                    <Target className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />Table
                  </button>
                </div>
                {googleConnected ? (
                  <button
                    onClick={toggleGoogle}
                    aria-pressed={showGoogle}
                    title={showGoogle ? 'Hide Google Calendar events' : 'Show Google Calendar events'}
                    className={`${pillBtn} ${showGoogle ? 'border-gold/25 bg-gold/10 text-gold hover:bg-gold/20' : 'border-white/10 bg-white/5 text-ink/40 hover:border-gold/25 hover:text-gold'}`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Google</span>
                    <span className="sm:hidden">Gcal</span>
                    {showGoogle && visibleGoogleEvents.length > 0 && (
                      <span className="rounded-full bg-gold/20 px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums leading-none">{visibleGoogleEvents.length}</span>
                    )}
                  </button>
                ) : (
                  <a
                    href="/settings"
                    title="Connect Google Calendar to see your events here"
                    className={`${pillBtn} border-white/10 bg-white/5 text-ink/50 hover:border-gold/25 hover:text-gold`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Google</span>
                    <span className="sm:hidden">Gcal</span>
                    <Plus className="w-3 h-3" />
                  </a>
                )}
                <button
                  onClick={() => (addingDeed ? setAddingDeed(false) : openAddDeed())}
                  className={`px-3 py-2 sm:py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-1 ${addingDeed ? 'bg-ember/20 text-[#cf8f78] border border-ember/30' : 'bg-gold text-ink hover:bg-gold-glow'}`}
                >
                  {addingDeed ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>{addingDeed ? 'Close' : 'Add Deed'}</span>
                </button>
              </div>
            </div>

            {addingDeed && (
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
            )}
          </Card>

          {viewMode === 'timeline' ? (
            <>
              <DeedAgenda
                tasks={allTasks}
                googleEvents={visibleGoogleEvents}
                showGoogle={showGoogle}
                countdownNow={countdownNow}
                onOpen={handleOpenDeed}
                onToggle={handleToggleTask}
              />
              <DeedTimeline
                dateStr={dateStr}
                tasks={allTasks}
                googleEvents={visibleGoogleEvents}
                showGoogle={showGoogle}
                categories={activeCategories}
                countdownNow={countdownNow}
                onOpen={handleOpenDeed}
                onToggle={handleToggleTask}
                onDelete={handleDeleteTask}
                onWeightChange={handleWeightChange}
                onProgressChange={handleProgressChange}
                onCreateAt={openAddDeed}
              />
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
          {viewMode === 'timeline' && (
            <UnscheduledDeeds
              tasks={unscheduledTasks}
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
