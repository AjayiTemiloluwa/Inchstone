'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useHierarchyStore, Item, Task } from '@/store/hierarchyStore'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useRouter, useParams } from 'next/navigation'
import { ChevronRight, BookOpen, Plus, X, CheckCircle2, Circle, Clock, Target, Trash2, StickyNote, Repeat, BarChart3, Upload, Activity, Calendar, ChevronLeft, ChevronDown } from 'lucide-react'
import { format, parseISO, subDays, subWeeks, subMonths, subYears, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfDay, endOfDay, eachDayOfInterval, addDays } from 'date-fns'
import dynamic from 'next/dynamic'

const RichNoteModal = dynamic(() => import('@/components/items/RichNoteModal').then(mod => mod.RichNoteModal), { ssr: false })
import { useToast } from '@/components/ui/ToastProvider'

type GraphRange = 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom'

type DeedModalData = {
  task: Task
  parentGoal: Item | null
}

export default function DayPage() {
  const router = useRouter()
  const params = useParams()
  const dateStr = params.date as string

  const { items, completionMap, setItems, updateItem, updateTask, getFlatItems } = useHierarchyStore()
  const { showToast, confirm } = useToast()
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline')
  const [reflectionText, setReflectionText] = useState('')
  const [reflectionTimer, setReflectionTimer] = useState<NodeJS.Timeout | null>(null)
  const [selectedDeed, setSelectedDeed] = useState<DeedModalData | null>(null)
  const [deedReflection, setDeedReflection] = useState('')
  const [addingDeed, setAddingDeed] = useState(false)
  const [newDeedTitle, setNewDeedTitle] = useState('')
  const [newDeedStart, setNewDeedStart] = useState('')
  const [newDeedEnd, setNewDeedEnd] = useState('')
  const [newDeedWeight, setNewDeedWeight] = useState('10')
  const [newDeedCategory, setNewDeedCategory] = useState<string>('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrencePattern, setRecurrencePattern] = useState('')
  const [recurrenceEnd, setRecurrenceEnd] = useState('')
  const [isFrog, setIsFrog] = useState(false)
  const [isHabit, setIsHabit] = useState(false)
  const [deedColor, setDeedColor] = useState('')
  const [dayNotes, setDayNotes] = useState<any[]>([])
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [editingNote, setEditingNote] = useState<any>(null)
  const [newHabitTitle, setNewHabitTitle] = useState('')
  const [newHabitPattern, setNewHabitPattern] = useState('daily')
  const [habitHistory, setHabitHistory] = useState<any[]>([])
  const [habitGraphRange, setHabitGraphRange] = useState<GraphRange>('month')
  const [habitGraphCustomStart, setHabitGraphCustomStart] = useState('')
  const [habitGraphCustomEnd, setHabitGraphCustomEnd] = useState('')
  const [showGraphDatePicker, setShowGraphDatePicker] = useState(false)
  const [showDeleteHabitMenu, setShowDeleteHabitMenu] = useState<string | null>(null)
  const [savingDeed, setSavingDeed] = useState(false)

  const activeCategories = getFlatItems().filter(i => i.layer === 1)
  const currentDate = parseISO(dateStr)
  const [nowLineTop, setNowLineTop] = useState<number | null>(null)
  const prevAddingDeed = useRef(addingDeed)

  const findDailyGoalsForDate = (): Item[] => {
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
  }

  const dailyGoals = findDailyGoalsForDate()

  useEffect(() => {
    if (addingDeed && !prevAddingDeed.current) {
      const goal = dailyGoals[0]
      if (goal) {
        const existingTasks = goal.tasks || []
        const totalWeight = existingTasks.reduce((sum, t) => sum + t.weight, 0)
        const remaining = Math.max(0, 100 - totalWeight)
        const calculated = existingTasks.length > 0 ? remaining / (existingTasks.length + 1) : 100
        setNewDeedWeight(String(Math.round(calculated * 10) / 10))
      }
    }
    prevAddingDeed.current = addingDeed
  }, [addingDeed, dailyGoals])

  useEffect(() => {
    const updateNowLine = () => {
      const now = new Date()
      if (dateStr === format(now, 'yyyy-MM-dd')) {
        const currentHour = now.getHours() + now.getMinutes() / 60
        setNowLineTop(currentHour * 64)
      } else {
        setNowLineTop(null)
      }
    }
    updateNowLine()
    const interval = setInterval(updateNowLine, 60000)
    return () => clearInterval(interval)
  }, [dateStr])

  const fetchDayNotes = async () => {
    try {
      const noteRes = await fetch(`/api/notes?date=${dateStr}`)
      if (noteRes.ok) {
        const data = await noteRes.json()
        setDayNotes(data.notes || [])
      }
    } catch (e) {
      console.error('Failed to fetch notes', e)
    }
  }

  useEffect(() => {
    fetchDayNotes()
  }, [dateStr])

  // Fetch today's habit tasks (from any goal) to show in the Habit Tracker
  const [todayHabits, setTodayHabits] = useState<any[]>([])

  const fetchTodayHabits = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks?date=${dateStr}&habit=true`)
      if (res.ok) {
        const data = await res.json()
        // Filter only habit tasks
        const habits = (data.tasks || []).filter((t: any) => t.isHabit)
        setTodayHabits(habits)
      }
    } catch (e) {
      console.error('Failed to fetch today habits', e)
    }
  }, [dateStr])

  useEffect(() => {
    fetchTodayHabits()
  }, [fetchTodayHabits, dateStr])

  // Fetch habit history for graph
  const fetchHabitHistory = useCallback(async () => {
    try {
      let url = '/api/habits?range=year'
      if (habitGraphRange === 'week') url = '/api/habits?range=week'
      else if (habitGraphRange === 'month') url = '/api/habits?range=month'
      else if (habitGraphRange === 'year') url = '/api/habits?range=year'
      else if (habitGraphRange === 'all') {
        const res = await fetch('/api/habits?t=' + Date.now())
        if (res.ok) {
          const data = await res.json()
          setHabitHistory(data.habits || [])
        }
        return
      } else if (habitGraphRange === 'custom' && habitGraphCustomStart && habitGraphCustomEnd) {
        url = `/api/habits?start=${habitGraphCustomStart}&end=${habitGraphCustomEnd}`
      }

      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setHabitHistory(data.habits || [])
      }
    } catch (e) {
      console.error('Failed to fetch habit history', e)
    }
  }, [habitGraphRange, habitGraphCustomStart, habitGraphCustomEnd])

  useEffect(() => {
    fetchHabitHistory()
  }, [fetchHabitHistory, dateStr])

  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.task-block')) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickY = e.clientY - rect.top + e.currentTarget.scrollTop
    const clickedHour = Math.max(0, Math.min(23, Math.floor(clickY / 64)))
    const startStr = `${String(clickedHour).padStart(2, '0')}:00`
    const endStr = `${String(Math.min(23, clickedHour + 1)).padStart(2, '0')}:00`
    setNewDeedStart(startStr)
    setNewDeedEnd(endStr)
    setAddingDeed(true)
  }

  const getPositionedTasks = (tasks: Task[]) => {
    const scheduled = tasks.filter(t => t.startTime && t.endTime).map(t => {
      const start = new Date(t.startTime!)
      const end = new Date(t.endTime!)
      const startHour = start.getHours() + start.getMinutes() / 60
      const endHour = Math.max(startHour + 0.5, end.getHours() + end.getMinutes() / 60)
      return { task: t, startHour, endHour }
    })
    scheduled.sort((a, b) => a.startHour - b.startHour)
    const groups: Array<typeof scheduled> = []
    let currentGroup: typeof scheduled = []
    let groupEnd = 0
    scheduled.forEach(item => {
      if (currentGroup.length === 0) {
        currentGroup.push(item)
        groupEnd = item.endHour
      } else if (item.startHour < groupEnd) {
        currentGroup.push(item)
        groupEnd = Math.max(groupEnd, item.endHour)
      } else {
        groups.push(currentGroup)
        currentGroup = [item]
        groupEnd = item.endHour
      }
    })
    if (currentGroup.length > 0) groups.push(currentGroup)
    const result: Array<{ task: Task; top: number; height: number; left: number; width: number }> = []
    groups.forEach(group => {
      const columns: Array<number[]> = []
      const taskPlacements: Array<{ item: typeof scheduled[0]; colIndex: number }> = []
      group.forEach(item => {
        let placed = false
        for (let i = 0; i < columns.length; i++) {
          const lastEndHour = columns[i][columns[i].length - 1]
          if (item.startHour >= lastEndHour) {
            columns[i].push(item.endHour)
            taskPlacements.push({ item, colIndex: i })
            placed = true
            break
          }
        }
        if (!placed) {
          columns.push([item.endHour])
          taskPlacements.push({ item, colIndex: columns.length - 1 })
        }
      })
      const numCols = columns.length
      taskPlacements.forEach(({ item, colIndex }) => {
        const top = item.startHour * 64
        const height = (item.endHour - item.startHour) * 64
        const width = 94 / numCols
        const left = colIndex * (96 / numCols) + 2
        result.push({ task: item.task, top, height, left, width })
      })
    })
    return result
  }

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/items')
      const data = await res.json()
      if (data.items) {
        const itemMap = new Map()
        data.items.forEach((item: any) => itemMap.set(item.id, { ...item, children: [], tasks: item.tasks || [] }))
        const tree: any[] = []
        data.items.forEach((item: any) => {
          if (item.parentId) {
            const parent = itemMap.get(item.parentId)
            if (parent) parent.children.push(itemMap.get(item.id))
          } else {
            tree.push(itemMap.get(item.id))
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

  const findItem = (id: string): Item | undefined => {
    const search = (nodes: Item[]): Item | undefined => {
      for (const n of nodes) {
        if (n.id === id) return n
        if (n.children) { const f = search(n.children); if (f) return f }
      }
      return undefined
    }
    return search(items)
  }

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
    return tasks
  }, [items, dateStr])
  const scheduledTasks = allTasks.filter(t => t.startTime && t.endTime)
  const unscheduledTasks = allTasks.filter(t => !t.startTime && !t.isHabit)
  const frogTasks = allTasks.filter(t => t.isFrog).sort((a, b) => {
    if (a.startTime && b.startTime) return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    if (a.startTime) return -1
    if (b.startTime) return 1
    return a.title.localeCompare(b.title)
  })
  const habitTasks = allTasks.filter(t => t.isHabit)
  // Day score counts only non-habit tasks (regular deeds)
  const deedTasks = allTasks.filter(t => !t.isHabit)
  const completedTasks = deedTasks.filter(t => t.completed)
  const totalWeight = deedTasks.reduce((sum, t) => sum + t.weight, 0)
  const dayScore = totalWeight > 0
    ? deedTasks.reduce((sum, t) => sum + (t.completed ? t.weight : 0), 0) / totalWeight * 100
    : 0
  const primaryGoal = dailyGoals[0]

  useEffect(() => {
    if (primaryGoal?.reflection && reflectionText === '') {
      setReflectionText(primaryGoal.reflection)
    }
  }, [primaryGoal, reflectionText])

  const saveReflection = useCallback((text: string) => {
    if (!primaryGoal) return
    if (reflectionTimer) clearTimeout(reflectionTimer)
    const timer = setTimeout(() => {
      updateItem(primaryGoal.id, { reflection: text })
    }, 800)
    setReflectionTimer(timer)
  }, [primaryGoal, updateItem, reflectionTimer])

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

  const handleSaveDeedChanges = async () => {
    if (!selectedDeed) return
    const task = selectedDeed.task
    const goalItem = findItem(task.goalId)
    if (!goalItem) return

    // Persist to backend
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: task.title,
          reflection: deedReflection,
          startTime: task.startTime,
          endTime: task.endTime,
          weight: task.weight,
          progress: task.progress,
          categoryId: task.categoryId,
          isRecurring: task.isRecurring,
          recurrencePattern: task.recurrencePattern,
          isFrog: task.isFrog,
          isHabit: task.isHabit,
          color: task.color,
        }),
      })
      if (!res.ok) {
        console.error('Save failed:', await res.text())
      }
    } catch (e) {
      console.error('Failed to save task changes:', e)
    }

    setSelectedDeed(null)

    // Refresh UI to show new instances
    await fetchItems()
    await fetchTodayHabits()
    await fetchHabitHistory()
    showToast(task.isRecurring ? 'Recurrence enabled — instances created!' : 'Changes saved', 'success')
  }

  const handleDeleteTask = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation()
    const task = allTasks.find(t => t.id === taskId)
    const isHabitTask = task?.isHabit

    if (isHabitTask) {
      const deleteChoice = await confirm(
        'Delete this habit?\n• "All" – removes all future instances\n• "Today" – removes only today\n• "Cancel" – keeps it'
      )
      if (!deleteChoice) return

      // Show inline menu for delete options
      setShowDeleteHabitMenu(taskId)
      return
    }

    if (!(await confirm('Delete this deed?'))) return
    await performDeleteTask(taskId)
  }

  const performDeleteTask = async (taskId: string, deleteAll?: boolean) => {
    try {
      const url = deleteAll ? `/api/tasks/${taskId}?deleteAll=true` : `/api/tasks/${taskId}`
      const res = await fetch(url, { method: 'DELETE' })
      if (!res.ok) {
        showToast('Failed to delete', 'error')
      } else {
        fetchItems()
        fetchHabitHistory()
        showToast('Deleted', 'success')
      }
    } catch (e) {
      console.error(e)
      showToast('Network error', 'error')
    }
    setShowDeleteHabitMenu(null)
  }

  const handleUpdateTaskWeight = async (taskId: string, goalId: string, weight: number) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weight })
      })
      updateTask(goalId, taskId, { weight })
    } catch (e) {
      console.error(e)
    }
  }

  const handleUpdateTaskProgress = async (taskId: string, goalId: string, progress: number) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress })
      })
      updateTask(goalId, taskId, { progress })
    } catch (e) {
      console.error(e)
    }
  }

  const handleAddDeed = async (overrides?: { isHabit?: boolean; isRecurring?: boolean; recurrencePattern?: string; isFrog?: boolean; color?: string; title?: string }) => {
    const finalIsHabit = overrides?.isHabit ?? isHabit
    const finalIsRecurring = overrides?.isRecurring ?? isRecurring
    const finalRecurrencePattern = overrides?.recurrencePattern ?? recurrencePattern
    const finalIsFrog = overrides?.isFrog ?? isFrog
    const finalColor = overrides?.color ?? deedColor
    const deedTitle = overrides?.title ?? newDeedTitle

    if (!deedTitle.trim() || savingDeed) return
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
        const dayName = format(currentDate, 'EEEE')
        const createRes = await fetch('/api/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            layer: 6,
            parentId: parentWeekId || null,
            title: dayName,
            weight: 14.3,
            startDate: dateStr,
            endDate: dateStr,
          })
        })
        const createData = await createRes.json()
        if (!createData.item?.id) {
          showToast('Could not create a daily goal for this date.', 'error')
          return
        }
        goalId = createData.item.id
        await new Promise<void>(resolve => {
          fetch('/api/items').then(r => r.json()).then(data => {
            if (data.items) {
              const itemMap = new Map()
              data.items.forEach((item: any) => itemMap.set(item.id, { ...item, children: [], tasks: item.tasks || [] }))
              const tree: any[] = []
              data.items.forEach((item: any) => {
                if (item.parentId) { const parent = itemMap.get(item.parentId); if (parent) parent.children.push(itemMap.get(item.id)) }
                else { tree.push(itemMap.get(item.id)) }
              })
              setItems(tree)
            }
            resolve()
          })
        })
      }

      const startTimeISO = newDeedStart ? new Date(`${dateStr}T${newDeedStart}:00`).toISOString() : null
      const endTimeISO = newDeedEnd ? new Date(`${dateStr}T${newDeedEnd}:00`).toISOString() : null
      const existingTasks = dailyGoals.find(dg => dg.id === goalId)?.tasks || []
      const totalExistingWeight = existingTasks.reduce((sum, t) => sum + t.weight, 0)
      const remaining = Math.max(0, 100 - totalExistingWeight)
      const calculatedWeight = existingTasks.length > 0 ? remaining / (existingTasks.length + 1) : 100
      const finalWeight = calculatedWeight > 0 ? calculatedWeight : 1

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalId,
          title: deedTitle.trim(),
          date: dateStr,
          startTime: startTimeISO,
          endTime: endTimeISO,
          weight: finalWeight,
          categoryId: newDeedCategory || null,
          isRecurring: finalIsRecurring,
          recurrencePattern: finalIsRecurring ? finalRecurrencePattern : null,
          recurrenceEnd: finalIsRecurring && recurrenceEnd ? new Date(recurrenceEnd).toISOString() : null,
          color: finalColor || null,
          isFrog: finalIsFrog,
          isHabit: finalIsHabit,
        })
      })
      const resData = await res.json()
      if (!res.ok) {
        showToast(`Failed to save task: ${resData.error || 'Unknown error'}`, 'error')
        return
      }
      fetchItems()
      fetchHabitHistory()
      showToast(finalIsHabit ? 'Habit added for every day going forward' : 'Deed added', 'success')
      setNewDeedTitle('')
      setNewDeedStart('')
      setNewDeedEnd('')
      setNewDeedWeight('10')
      setNewDeedCategory('')
      setIsRecurring(false)
      setRecurrencePattern('')
      setRecurrenceEnd('')
      setIsFrog(false)
      setIsHabit(false)
      setDeedColor('')
      setAddingDeed(false)
    } catch (e) {
      console.error('Error adding deed:', e)
      showToast('An error occurred while saving the task.', 'error')
    } finally {
      setSavingDeed(false)
    }
  }

  // Build habit graph data — SMOOTH CUBIC BEZIER showing overall completion % per day
  const buildHabitGraph = () => {
    if (habitHistory.length === 0) return null

    // Group by date: count total habits and completed habits per day
    const byDate: Record<string, { total: number; done: number }> = {}
    habitHistory.forEach((h: any) => {
      const d = new Date(h.date).toISOString().substring(0, 10)
      if (!byDate[d]) byDate[d] = { total: 0, done: 0 }
      byDate[d].total++
      if (h.completed) byDate[d].done++
    })

    // Collect and sort all dates
    let dates = Object.keys(byDate).sort()

    // Limit dates based on range
    if (dates.length > 90 && habitGraphRange !== 'all') {
      dates = dates.slice(-90)
    }

    if (dates.length < 2) return null

    const width = 120
    const height = 100
    const padding = { top: 6, right: 6, bottom: 18, left: 18 }
    const chartW = width - padding.left - padding.right
    const chartH = height - padding.top - padding.bottom
    const stepX = chartW / (dates.length - 1)

    const gold = 'rgb(212, 175, 55)'
    const sage = 'rgb(143, 188, 143)'

    // Build single line — overall completion percentage per day with 3-day rolling avg
    const points = dates.map((date, i) => {
      let totalDone = 0
      let totalCount = 0
      for (let offset = -1; offset <= 1; offset++) {
        const neighborIdx = i + offset
        if (neighborIdx >= 0 && neighborIdx < dates.length) {
          const d = dates[neighborIdx]
          if (byDate[d]) {
            totalDone += byDate[d].done
            totalCount += byDate[d].total
          }
        }
      }
      const rate = totalCount > 0 ? (totalDone / totalCount) * 100 : 0
      const x = padding.left + i * stepX
      const y = padding.top + chartH - (rate / 100) * chartH
      return { x, y, date, rawRate: byDate[date] ? (byDate[date].done / byDate[date].total) * 100 : 0 }
    })

    // Generate standard monotone cubic bezier path (industry standard, no overshoot)
    const getMonotonePath = (pts: typeof points) => {
      if (pts.length < 2) return ''
      let path = `M ${pts[0].x} ${pts[0].y}`
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i]
        const p1 = pts[i + 1]
        const dx = p1.x - p0.x
        const dy = p1.y - p0.y

        // Compute tangents using finite differences
        let m0: number, m1: number
        if (i === 0) {
          m0 = dy / dx
          m1 = (pts[i + 2] ? (pts[i + 2].y - p0.y) / (pts[i + 2].x - p0.x) : dy / dx)
        } else if (i >= pts.length - 2) {
          m0 = (p1.y - pts[i - 1].y) / (p1.x - pts[i - 1].x)
          m1 = dy / dx
        } else {
          const mPrev = (p1.y - pts[i - 1].y) / (p1.x - pts[i - 1].x)
          const mNext = (pts[i + 2].y - p0.y) / (pts[i + 2].x - p0.x)
          m0 = (mPrev + mNext) / 2
          m1 = m0
        }

        // Monotone preservation: clamp tangents
        if (dy === 0) {
          m0 = 0
          m1 = 0
        } else {
          const maxSlope = 3 * Math.abs(dy / dx)
          m0 = Math.max(-maxSlope, Math.min(maxSlope, m0))
          m1 = Math.max(-maxSlope, Math.min(maxSlope, m1))
        }

        const cp1x = p0.x + dx / 3
        const cp1y = p0.y + m0 * dx / 3
        const cp2x = p1.x - dx / 3
        const cp2y = p1.y - m1 * dx / 3
        path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`
      }
      return path
    }

    const smoothPath = getMonotonePath(points)

    // Generate area path (monotone path closed at bottom)
    const getAreaPath = (pts: typeof points) => {
      if (pts.length < 2) return ''
      const bottomY = padding.top + chartH
      let path = `M ${pts[0].x} ${bottomY} L ${pts[0].x} ${pts[0].y}`
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i]
        const p1 = pts[i + 1]
        const dx = p1.x - p0.x
        const dy = p1.y - p0.y

        let m0: number, m1: number
        if (i === 0) {
          m0 = dy / dx
          m1 = (pts[i + 2] ? (pts[i + 2].y - p0.y) / (pts[i + 2].x - p0.x) : dy / dx)
        } else if (i >= pts.length - 2) {
          m0 = (p1.y - pts[i - 1].y) / (p1.x - pts[i - 1].x)
          m1 = dy / dx
        } else {
          const mPrev = (p1.y - pts[i - 1].y) / (p1.x - pts[i - 1].x)
          const mNext = (pts[i + 2].y - p0.y) / (pts[i + 2].x - p0.x)
          m0 = (mPrev + mNext) / 2
          m1 = m0
        }

        if (dy === 0) {
          m0 = 0
          m1 = 0
        } else {
          const maxSlope = 3 * Math.abs(dy / dx)
          m0 = Math.max(-maxSlope, Math.min(maxSlope, m0))
          m1 = Math.max(-maxSlope, Math.min(maxSlope, m1))
        }

        const cp1x = p0.x + dx / 3
        const cp1y = p0.y + m0 * dx / 3
        const cp2x = p1.x - dx / 3
        const cp2y = p1.y - m1 * dx / 3
        path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`
      }
      path += ` L ${pts[pts.length - 1].x} ${bottomY} Z`
      return path
    }

    const areaPath = getAreaPath(points)

    return {
      dates,
      points,
      gold,
      sage,
      width,
      height,
      padding,
      chartW,
      chartH,
      stepX,
      smoothPath,
      areaPath,
    }
  }

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
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to add habit', 'error')
      }
    } catch (e) {
      console.error(e)
      showToast('Network error', 'error')
    }
  }

  const hours = Array.from({ length: 24 }, (_, i) => i)

  const formatHourLabel = (hour: number): string => {
    if (hour === 0) return '12 AM'
    if (hour < 12) return `${hour} AM`
    if (hour === 12) return '12 PM'
    return `${hour - 12} PM`
  }

  // Graph range label
  const graphRangeLabel = (range: GraphRange) => {
    switch (range) {
      case 'week': return 'Week'
      case 'month': return 'Month'
      case 'quarter': return 'Quarter'
      case 'year': return 'Year'
      case 'all': return 'All Time'
      case 'custom': return 'Custom'
    }
  }

  if (loading) return <div className="flex justify-center items-center h-full"><span className="text-ink/60">Loading...</span></div>

  return (
    <div className="space-y-6 max-w-full pb-12 stagger-children">
      <div className="flex items-center space-x-2 text-sm text-ink/50 flex-wrap">
        <button onClick={() => router.push('/year')} className="hover:text-gold transition">Year</button>
        <ChevronRight className="w-3 h-3" />
        <span className="text-ink font-bold">{format(currentDate, 'EEEE, MMMM d, yyyy')}</span>
      </div>

      <div className="glass-gold glow-sm rounded-3xl p-8 animate-slideUp border border-gold/20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-display font-bold bg-gradient-to-r from-gold to-gold-glow bg-clip-text text-transparent">{format(currentDate, 'EEEE')}</h1>
            <p className="text-lg text-ink/70 mt-2 font-mono">{format(currentDate, 'MMMM d, yyyy')}</p>
          </div>
          <div className="flex items-center space-x-6">
            <div className="text-right">
              <p className="text-xs text-ink/50 uppercase font-bold">Tasks</p>
              <p className="text-xl font-mono font-bold">{completedTasks.length}/{deedTasks.length}</p>
            </div>
            <ProgressRing progress={dayScore} size={64} />
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-ink/50 mb-1">
            <span>Day Progress</span>
            <span className="font-mono font-bold">{Math.round(dayScore)}%</span>
          </div>
          <ProgressBar progress={dayScore} colorClass={dayScore >= 80 ? 'bg-sage' : dayScore >= 40 ? 'bg-gold' : 'bg-coral'} />
        </div>
      </div>

      {/* Eat That Frog Section */}
      <Card className="p-5 border border-gold/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Target className="w-24 h-24 text-gold" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-display font-bold text-ink flex items-center space-x-2">
                <span className="text-2xl">🐸</span>
                <span>Eat That Frog</span>
              </h2>
              <p className="text-xs text-ink/60 mt-1">Your most important tasks.</p>
            </div>
            <button
              onClick={() => { setIsFrog(true); setAddingDeed(true) }}
              className="px-3 py-1.5 text-xs font-medium bg-gold/10 text-gold rounded-lg border border-gold/30 hover:bg-gold/20 transition flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Frog</span>
            </button>
          </div>
          <div className="space-y-2">
            {frogTasks.map((task, idx) => {
              const frogNum = idx + 1
              return (
                <div key={task.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${task.completed ? 'glass border-sage/30 bg-sage/5 opacity-80 text-ink/50' : 'bg-black/20 border-white/10 hover:border-gold/50'}`}>
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <button onClick={() => handleToggleTask(task)} className="shrink-0">
                      {task.completed ? <CheckCircle2 className="w-5 h-5 text-sage" /> : <Circle className="w-5 h-5 text-ink/30" />}
                    </button>
                    <span className="text-[10px] font-bold text-gold bg-gold/10 px-2 py-0.5 rounded-full shrink-0">Frog #{frogNum}</span>
                    <span className={`font-bold truncate ${task.completed ? 'line-through' : 'text-ink'}`}>{task.title}</span>
                  </div>
                  <div className="flex items-center space-x-3 shrink-0">
                    <span className={`text-[9px] flex items-center space-x-1 ${task.startTime ? 'text-gold' : 'text-ink/30'}`}>
                      <Clock className="w-3 h-3" />
                      <span>{task.startTime ? 'Scheduled' : 'No time'}</span>
                    </span>
                    {task.startTime && (
                      <span className="text-[10px] font-mono text-ink/40">{format(new Date(task.startTime), 'h:mm a')}</span>
                    )}
                    <button onClick={(e) => handleDeleteTask(e, task.id)} className="p-1.5 hover:bg-red-500/10 rounded-lg transition text-ink/30 hover:text-red-500" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
            {frogTasks.length === 0 && (
              <p className="text-xs text-ink/40 py-2">No frogs designated for today. Identify your hardest task!</p>
            )}
          </div>
        </div>
      </Card>

      {/* Daily Tracker — now the unified Habit Tracker */}
      <Card className="p-5 border border-gold/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Activity className="w-24 h-24 text-gold" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-display font-bold text-ink flex items-center space-x-2">
                <Activity className="w-5 h-5 text-gold" />
                <span>Habit Tracker</span>
              </h2>
              <p className="text-xs text-ink/60 mt-1">Track your daily habits. Each habit repeats every day once created.</p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newHabitTitle}
                onChange={e => setNewHabitTitle(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Enter' && newHabitTitle.trim()) {
                    const title = newHabitTitle.trim()
                    setNewHabitTitle('')
                    await handleQuickAddHabit(title, newHabitPattern)
                  }
                }}
                placeholder="New habit..."
                className="px-3 py-2 text-xs bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30 text-ink/80 w-40"
              />
              <select
                value={newHabitPattern}
                onChange={e => setNewHabitPattern(e.target.value)}
                className="px-3 py-2 text-xs bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30 text-ink/80 w-28"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="weekdays">Weekdays</option>
              </select>
              <button
                onClick={async () => {
                  if (newHabitTitle.trim()) {
                    const title = newHabitTitle.trim()
                    setNewHabitTitle('')
                    await handleQuickAddHabit(title, newHabitPattern)
                  }
                }}
                className="px-3 py-2 text-xs font-bold bg-gold text-paper rounded-lg hover:bg-gold-glow transition flex items-center space-x-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Today's Habits */}
          <div className="space-y-2 mb-6">
            {(todayHabits.length > 0 ? todayHabits : habitTasks).map((task: any) => (
              <div key={task.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${task.completed ? 'glass border-sage/30 bg-sage/5 opacity-80' : 'bg-black/20 border-white/10 hover:border-gold/50'}`}>
                <div className="flex items-center space-x-3 flex-1">
                  <button onClick={async () => {
                    // Toggle via API directly since habit may not be in the goal's task list
                    await fetch(`/api/tasks/${task.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ completed: !task.completed }),
                    })
                    setTodayHabits(prev => prev.map((h: any) => h.id === task.id ? { ...h, completed: !h.completed } : h))
                    fetchHabitHistory()
                  }} className="shrink-0">
                    {task.completed ? <CheckCircle2 className="w-5 h-5 text-sage" /> : <Circle className="w-5 h-5 text-ink/30" />}
                  </button>
                  <span className={`font-bold text-sm ${task.completed ? 'line-through text-ink/50' : 'text-ink'}`}>{task.title}</span>
                </div>
                <div className="relative">
                  <button onClick={(e) => handleDeleteTask(e, task.id)} className="p-1.5 hover:bg-red-500/10 rounded-lg transition text-ink/30 hover:text-red-500" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {showDeleteHabitMenu === task.id && (
                    <div className="absolute right-0 top-8 z-50 bg-paper border border-mist rounded-xl shadow-xl p-2 min-w-[180px] animate-fadeIn">
                      <p className="text-[10px] text-ink/50 px-3 py-1 font-bold uppercase">Delete options</p>
                      <button onClick={() => performDeleteTask(task.id, true)} className="w-full text-left px-3 py-2 text-xs text-ink hover:bg-mist rounded-lg transition flex items-center space-x-2">
                        <Repeat className="w-3.5 h-3.5" />
                        <span>Delete all future instances</span>
                      </button>
                      <button onClick={() => performDeleteTask(task.id, false)} className="w-full text-left px-3 py-2 text-xs text-ink hover:bg-mist rounded-lg transition flex items-center space-x-2">
                        <X className="w-3.5 h-3.5" />
                        <span>Delete only today</span>
                      </button>
                      <button onClick={() => setShowDeleteHabitMenu(null)} className="w-full text-left px-3 py-2 text-xs text-ink/50 hover:bg-mist rounded-lg transition">
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {todayHabits.length === 0 && habitTasks.length === 0 && (
              <p className="text-xs text-ink/40 text-center py-4">No habits yet. Add one and it will repeat every day going forward.</p>
            )}
          </div>

          {/* Habit Graph */}
          {habitHistory.length > 0 && (() => {
            const graph = buildHabitGraph()
            if (!graph) return null

            const totalHabitTitles = [...new Set(habitHistory.map((h: any) => h.title))]
            const completionRates = totalHabitTitles.map((title: string) => {
              const instances = habitHistory.filter((h: any) => h.title === title)
              const total = instances.length
              const done = instances.filter((h: any) => h.completed).length
              return { title, rate: total > 0 ? Math.round((done / total) * 100) : 0 }
            })

            return (
              <div className="mt-6 pt-4 border-t border-white/10">
                {/* Range selector */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="w-4 h-4 text-gold" />
                    <h3 className="text-xs font-bold uppercase text-ink/50">Habit Completion</h3>
                  </div>
                  <div className="flex items-center space-x-1">
                    {(['week', 'month', 'quarter', 'year', 'all'] as GraphRange[]).map(range => (
                      <button
                        key={range}
                        onClick={() => { setHabitGraphRange(range); setShowGraphDatePicker(false) }}
                        className={`px-2 py-1 text-[9px] font-bold rounded-lg transition ${habitGraphRange === range && !showGraphDatePicker
                          ? 'bg-gold/20 text-gold border border-gold/30'
                          : 'text-ink/40 hover:text-ink hover:bg-white/5 border border-transparent'
                          }`}
                      >
                        {graphRangeLabel(range)}
                      </button>
                    ))}
                    <div className="relative">
                      <button
                        onClick={() => setShowGraphDatePicker(!showGraphDatePicker)}
                        className={`px-2 py-1 text-[9px] font-bold rounded-lg transition flex items-center space-x-1 ${habitGraphRange === 'custom' || showGraphDatePicker
                          ? 'bg-gold/20 text-gold border border-gold/30'
                          : 'text-ink/40 hover:text-ink hover:bg-white/5 border border-transparent'
                          }`}
                      >
                        <Calendar className="w-3 h-3" />
                        <span>Custom</span>
                      </button>
                      {showGraphDatePicker && (
                        <div className="absolute right-0 top-8 z-50 bg-paper border border-mist rounded-xl shadow-xl p-3 min-w-[240px] animate-fadeIn">
                          <div className="space-y-2">
                            <div>
                              <label className="text-[9px] text-ink/50 font-bold uppercase">From</label>
                              <input type="date" value={habitGraphCustomStart} onChange={e => setHabitGraphCustomStart(e.target.value)}
                                className="w-full px-2 py-1.5 text-xs bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30 text-ink/80 mt-1" />
                            </div>
                            <div>
                              <label className="text-[9px] text-ink/50 font-bold uppercase">To</label>
                              <input type="date" value={habitGraphCustomEnd} onChange={e => setHabitGraphCustomEnd(e.target.value)}
                                className="w-full px-2 py-1.5 text-xs bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30 text-ink/80 mt-1" />
                            </div>
                            <button
                              onClick={() => { if (habitGraphCustomStart && habitGraphCustomEnd) { setHabitGraphRange('custom'); setShowGraphDatePicker(false); fetchHabitHistory() } }}
                              className="w-full px-3 py-1.5 text-xs font-bold bg-gold text-paper rounded-lg hover:bg-gold-glow transition"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Habit overall completion rates */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4">
                  {completionRates.map(({ title, rate }) => (
                    <div key={title} className="bg-black/20 border border-white/10 rounded-lg p-2 text-center">
                      <p className="text-[8px] text-ink/50 truncate font-bold uppercase">{title}</p>
                      <p className="text-sm font-mono font-bold text-gold">{rate}%</p>
                    </div>
                  ))}
                </div>

                {/* SVG Line Graph — ultra smooth flowing curve with colored bottom */}
                <div className="h-48">
                  <svg viewBox={`0 0 ${graph.width} ${graph.height}`} className="w-full h-full" preserveAspectRatio="none">
                    <defs>
                      {/* Rich gradient fill under the curve — colored bottom */}
                      <linearGradient id="habitGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={graph.gold} stopOpacity="0.35" />
                        <stop offset="30%" stopColor={graph.gold} stopOpacity="0.20" />
                        <stop offset="70%" stopColor={graph.gold} stopOpacity="0.10" />
                        <stop offset="100%" stopColor={graph.gold} stopOpacity="0.40" />
                      </linearGradient>
                      {/* Stronger bottom-only fill */}
                      <linearGradient id="bottomGlow" x1="0" y1="0.7" x2="0" y2="1">
                        <stop offset="0%" stopColor={graph.gold} stopOpacity="0" />
                        <stop offset="100%" stopColor={graph.gold} stopOpacity="0.25" />
                      </linearGradient>
                      {/* Glow filter for the line */}
                      <filter id="habitGlow" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>

                    {/* Grid lines with premium percentile labels */}
                    {[0, 25, 50, 75, 100].map(pct => {
                      const y = graph.padding.top + graph.chartH - (pct / 100) * graph.chartH
                      return (
                        <g key={pct}>
                          <line x1={graph.padding.left} y1={y} x2={graph.width - graph.padding.right} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" strokeDasharray="2,3" />
                          <text x={graph.padding.left - 4} y={y + 1.5} textAnchor="end" className="text-[3.5px] fill-ink/25 font-mono" fontWeight="500">{pct}%</text>
                        </g>
                      )
                    })}

                    {/* Bottom accent bar */}
                    <rect x={graph.padding.left} y={graph.padding.top + graph.chartH} width={graph.chartW} height={2} fill={graph.gold} opacity="0.15" rx="1" />

                    {/* Smooth area fill — full gradient */}
                    {graph.areaPath && (
                      <path d={graph.areaPath} fill="url(#habitGradient)" />
                    )}

                    {/* Bottom glow layer */}
                    {graph.areaPath && (
                      <path d={graph.areaPath} fill="url(#bottomGlow)" />
                    )}

                    {/* Smooth line with glow */}
                    {graph.smoothPath && (
                      <path d={graph.smoothPath} fill="none" stroke={graph.gold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#habitGlow)" opacity="0.95" />
                    )}

                    {/* X-Axis Date Labels */}
                    {graph.dates && graph.dates.length > 1 && (() => {
                      const totalDates = graph.dates.length
                      const indicesToDisplay = [
                        0,
                        Math.floor(totalDates * 0.25),
                        Math.floor(totalDates * 0.5),
                        Math.floor(totalDates * 0.75),
                        totalDates - 1
                      ].filter((v, i, a) => a.indexOf(v) === i)
                      
                      return indicesToDisplay.map(idx => {
                        const dateStr = graph.dates[idx]
                        const pt = graph.points[idx]
                        if (!pt) return null
                        let formatted = dateStr
                        try {
                          formatted = format(parseISO(dateStr), 'MMM d')
                        } catch (e) {}
                        
                        return (
                          <text
                            key={idx}
                            x={pt.x}
                            y={graph.padding.top + graph.chartH + 11}
                            textAnchor="middle"
                            className="text-[3.2px] fill-ink/40 font-mono"
                            fontWeight="500"
                          >
                            {formatted}
                          </text>
                        )
                      })
                    })()}

                    {/* Bottom gradient overlay bar */}
                    <rect x={graph.padding.left} y={graph.padding.top + graph.chartH - 8} width={graph.chartW} height={8} fill={`url(#bottomGlow)`} opacity="0.6" />
                  </svg>
                </div>
              </div>
            )
          })()}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <StickyNote className="w-5 h-5 text-gold" />
            <h2 className="text-xl font-display font-bold text-ink">Day Notes</h2>
          </div>
          <button
            onClick={() => { setEditingNote(null); setShowNoteModal(true) }}
            className="px-3 py-1.5 text-xs font-medium bg-ink text-surface rounded hover:bg-ink/90 transition flex items-center space-x-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Note</span>
          </button>
        </div>
        {dayNotes.length === 0 ? (
          <p className="text-xs text-ink/40 text-center py-4">No notes for this day yet.</p>
        ) : (
          <div className="space-y-3">
            {dayNotes.map(note => (
              <div key={note.id} className="bg-black/20 border border-white/10 rounded-xl p-4 hover:border-gold/50 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-bold text-sm text-ink">{note.title}</h4>
                    <div
                      className="text-xs text-ink/70 mt-1 prose prose-sm max-w-none line-clamp-2"
                      dangerouslySetInnerHTML={{ __html: note.content }}
                    />
                    <p className="text-[10px] text-ink/40 mt-2 font-mono">
                      {new Date(note.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-1 ml-3">
                    <button
                      onClick={() => { setEditingNote(note); setShowNoteModal(true) }}
                      className="p-1.5 hover:bg-mist rounded transition text-ink/50 hover:text-gold"
                      title="Edit note"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="flex items-center space-x-4">
        <button
          onClick={() => setViewMode('timeline')}
          className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all ${viewMode === 'timeline' ? 'bg-gold text-paper shadow-lg shadow-gold/20' : 'bg-black/20 border border-white/10 text-ink/60 hover:text-gold hover:border-gold/30'}`}
        >
          <Clock className="w-4 h-4 inline mr-1.5" />24h Timeline
        </button>
        <button
          onClick={() => setViewMode('table')}
          className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all ${viewMode === 'table' ? 'bg-gold text-paper shadow-lg shadow-gold/20' : 'bg-black/20 border border-white/10 text-ink/60 hover:text-gold hover:border-gold/30'}`}
        >
          <Target className="w-4 h-4 inline mr-1.5" />Table
        </button>
        <div className="flex-1" />
        <button onClick={() => setAddingDeed(!addingDeed)} className="p-2.5 bg-black/20 border border-white/10 rounded-xl transition-all text-ink/50 hover:text-gold hover:border-gold/30">
          {addingDeed ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
        </button>
      </div>

      {addingDeed && (
        <Card className="p-5 space-y-4 animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <input type="text" value={newDeedTitle} onChange={e => setNewDeedTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddDeed()}
              placeholder="Deed title..." className="col-span-2 px-4 py-2.5 text-sm bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-ink/30" autoFocus />
            <input type="time" value={newDeedStart} onChange={e => setNewDeedStart(e.target.value)}
              className="px-4 py-2.5 text-sm bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 text-ink/80" />
            <input type="time" value={newDeedEnd} onChange={e => setNewDeedEnd(e.target.value)}
              className="px-4 py-2.5 text-sm bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 text-ink/80" />
            <select value={newDeedCategory} onChange={e => setNewDeedCategory(e.target.value)} className="px-4 py-2.5 text-sm bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 text-ink/80">
              <option value="">Category</option>
              {getFlatItems().filter(i => i.layer === 1).map(cat => <option key={cat.id} value={cat.id}>{cat.title}</option>)}
            </select>
            <div className="flex space-x-2">
              <input type="number" value={newDeedWeight} onChange={e => setNewDeedWeight(e.target.value)}
                min="1" max="100" placeholder="Wt"
                className="w-16 px-3 py-2.5 text-sm bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 text-ink/80" />
              <button onClick={() => handleAddDeed()} disabled={savingDeed} className="flex-1 px-4 py-2.5 bg-gold text-paper text-sm font-bold rounded-xl hover:bg-gold-glow transition-all active:scale-95 shadow-lg shadow-gold/20 disabled:opacity-50">{savingDeed ? 'Adding...' : 'Add'}</button>
            </div>
          </div>
          {/* Color picker */}
          <div className="md:col-span-6 space-y-2">
            <p className="text-[9px] font-bold uppercase text-ink/40 tracking-wider">Color</p>
            <div className="flex flex-wrap gap-2">
              {['#d4af37', '#8fbc8f', '#6495ed', '#ff7f50', '#9370db', '#3cb371', '#ffd700', '#00bfff', '#ff6b6b', '#a8e6cf', '#ffb347', '#ba68c8'].map(c => (
                <button
                  key={c}
                  onClick={() => setDeedColor(deedColor === c ? '' : c)}
                  className="w-7 h-7 rounded-full border-2 transition-all"
                  style={{ backgroundColor: c, borderColor: deedColor === c ? 'white' : 'transparent' }}
                />
              ))}
              <button onClick={() => setDeedColor('')} className={`px-2 py-0.5 text-[9px] font-bold rounded border ${!deedColor ? 'bg-white/20 border-white/40 text-ink' : 'border-white/10 text-ink/50'}`}>None</button>
            </div>
          </div>
          <div className="md:col-span-6 border-t border-white/10 pt-4 flex items-center space-x-6">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isFrog}
                onChange={e => setIsFrog(e.target.checked)}
                className="w-4 h-4 rounded border-mist text-gold focus:ring-gold"
              />
              <span className="text-xs font-bold text-ink/70 flex items-center space-x-1">
                <span className="text-sm">🐸</span>
                <span>Eat That Frog</span>
              </span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isHabit}
                onChange={e => {
                  setIsHabit(e.target.checked)
                  if (e.target.checked) {
                    setIsRecurring(true)
                    setRecurrencePattern('daily')
                  }
                }}
                className="w-4 h-4 rounded border-mist text-gold focus:ring-gold"
              />
              <span className="text-xs font-bold text-ink/70 flex items-center space-x-1">
                <span className="text-sm">🌱</span>
                <span>Habit (repeats daily)</span>
              </span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={e => setIsRecurring(e.target.checked)}
                className="w-4 h-4 rounded border-mist text-gold focus:ring-gold"
              />
              <span className="text-xs font-bold text-ink/70 flex items-center space-x-1">
                <Repeat className="w-3.5 h-3.5" />
                <span>Recurring Task</span>
              </span>
            </label>
          </div>
          {isRecurring && (
            <div className="md:col-span-6 grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              <select
                value={recurrencePattern}
                onChange={e => setRecurrencePattern(e.target.value)}
                className="px-4 py-2.5 text-sm bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 text-ink/80"
              >
                <option value="">Repeat...</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="weekdays">Weekdays (Mon-Fri)</option>
              </select>
              <input
                type="date"
                value={recurrenceEnd}
                onChange={e => setRecurrenceEnd(e.target.value)}
                className="px-4 py-2.5 text-sm bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 text-ink/80"
                placeholder="End date (optional)"
              />
            </div>
          )}
        </Card>
      )}

      {/* Hidden button to trigger habit add via input */}
      <button id="trigger-habit-add" className="hidden" onClick={() => {
        if (!newDeedTitle.trim()) return
        handleAddDeed({ isHabit: true, isRecurring: true, recurrencePattern: 'daily' })
      }} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2">
          {viewMode === 'timeline' ? (
            <div className="relative glass rounded-2xl overflow-hidden flex select-none animate-fadeIn border border-white/10" style={{ height: `${24 * 64}px` }}>
              <div className="w-20 shrink-0 border-r border-white/10 bg-black/20 relative z-10">
                {hours.map(hour => (
                  <div key={hour} className="absolute left-0 right-0 text-right pr-3 text-[10px] font-mono text-ink/40" style={{ top: `${hour * 64 + 6}px`, height: '64px' }}>
                    {formatHourLabel(hour)}
                  </div>
                ))}
              </div>
              <div className="flex-1 relative cursor-crosshair" onClick={handleGridClick}>
                {hours.map(hour => (
                  <div key={hour} className="absolute left-0 right-0 border-b border-white/5" style={{ top: `${hour * 64}px`, height: '64px' }} />
                ))}
                {nowLineTop !== null && (
                  <div className="absolute left-0 right-0 flex items-center z-20 pointer-events-none" style={{ top: `${nowLineTop}px` }}>
                    <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                    <div className="flex-1 h-0.5 bg-red-500" />
                  </div>
                )}
                {getPositionedTasks(allTasks).map(({ task, top, height, left, width }) => {
                  const goalItem = findItem(task.goalId)
                  const taskBorderColor = task.color || (task.completed ? '#8fbc8f' : '#d4af37')
                  return (
                    <div
                      key={task.id}
                      onClick={(e) => { e.stopPropagation(); handleOpenDeed(task) }}
                      className={`absolute rounded-xl border p-2.5 text-left text-xs flex flex-col justify-between transition-all hover:shadow-lg cursor-pointer group/task select-none overflow-hidden task-block ${task.completed ? 'glass text-ink/50 opacity-80' : 'text-ink hover:-translate-y-0.5'}`}
                      style={{ top: `${top + 2}px`, height: `${height - 4}px`, left: `${left}%`, width: `${width}%`, zIndex: 10, borderLeft: `4px solid ${taskBorderColor}`, borderColor: task.completed ? `${taskBorderColor}40` : taskBorderColor, background: task.completed ? `${taskBorderColor}20` : `${taskBorderColor}35` }}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex items-center space-x-1.5 min-w-0">
                          <button onClick={(e) => { e.stopPropagation(); handleToggleTask(task) }} className="shrink-0">
                            {task.completed ? <CheckCircle2 className="w-3.5 h-3.5 text-sage" /> : <Circle className="w-3.5 h-3.5 text-ink/30" />}
                          </button>
                          <span className={`font-semibold truncate ${task.completed ? 'line-through' : ''}`}>{task.title}</span>
                        </div>
                        <button onClick={(e) => handleDeleteTask(e, task.id)} className="shrink-0 p-0.5 opacity-0 group-hover/task:opacity-100 hover:bg-red-50 rounded transition text-ink/30 hover:text-red-500" title="Delete">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="space-y-1 mt-1">
                        {task.startTime && task.endTime && (
                          <div className="text-[10px] text-ink/40 font-mono">
                            {format(new Date(task.startTime), 'h:mm a')} - {format(new Date(task.endTime), 'h:mm a')}
                          </div>
                        )}
                        {task.categoryId && (() => {
                          const category = items.find(i => i.id === task.categoryId)
                          return category ? (
                            <span className="inline-block text-[8px] font-bold uppercase tracking-wider bg-gold/20 text-gold px-1.5 py-0.5 rounded">
                              {category.title}
                            </span>
                          ) : null
                        })()}
                        <div className="flex items-center space-x-1" onClick={e => e.stopPropagation()}>
                          <span className="text-[9px] text-ink/40">Wt</span>
                          <input
                            type="number" min="1" max="100" value={task.weight}
                            onChange={e => goalItem && handleUpdateTaskWeight(task.id, goalItem.id, parseFloat(e.target.value) || 1)}
                            className="w-8 px-0.5 py-0.5 bg-transparent rounded border border-transparent hover:border-mist focus:bg-paper focus:border-gold outline-none text-right font-mono text-[10px]"
                          />
                          <span className="text-[9px] text-ink/40">%</span>
                        </div>
                        <div className="flex items-center space-x-1" onClick={e => e.stopPropagation()}>
                          <span className="text-[9px] text-ink/40">Prog</span>
                          <input
                            type="range" min="0" max="100" step="1" value={Math.round(task.progress)}
                            onChange={e => goalItem && handleUpdateTaskProgress(task.id, goalItem.id, parseFloat(e.target.value) || 0)}
                            className="flex-1 h-1 bg-mist rounded-full appearance-none cursor-pointer accent-gold"
                          />
                          <span className="text-[9px] font-mono text-ink/40 w-6 text-right">{Math.round(task.progress)}%</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="glass rounded-2xl overflow-hidden border border-white/10 animate-fadeIn">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-black/20">
                    <th className="text-left p-3 text-xs font-bold uppercase text-ink/50">Time</th>
                    <th className="text-left p-3 text-xs font-bold uppercase text-ink/50">Deed</th>
                    <th className="text-left p-3 text-xs font-bold uppercase text-ink/50">Weight</th>
                    <th className="text-left p-3 text-xs font-bold uppercase text-ink/50">Status</th>
                    <th className="text-left p-3 text-xs font-bold uppercase text-ink/50">Reflection</th>
                    <th className="text-left p-3 text-xs font-bold uppercase text-ink/50 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {allTasks.sort((a, b) => {
                    if (!a.startTime) return 1
                    if (!b.startTime) return -1
                    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
                  }).map(t => {
                    const goalItem = findItem(t.goalId)
                    return (
                      <tr key={t.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors cursor-pointer group" onClick={() => handleOpenDeed(t)}>
                        <td className="p-3 font-mono text-xs text-ink/50">
                          {t.startTime ? format(new Date(t.startTime), 'h:mm a') : '—'}
                          {t.endTime ? `–${format(new Date(t.endTime), 'h:mm a')}` : ''}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center space-x-2">
                            <button onClick={(e) => { e.stopPropagation(); handleToggleTask(t) }} className="shrink-0">
                              {t.completed ? <CheckCircle2 className="w-4 h-4 text-sage" /> : <Circle className="w-4 h-4 text-ink/30" />}
                            </button>
                            <span className={t.completed ? 'line-through text-ink/50' : 'text-ink'}>{t.title}</span>
                          </div>
                        </td>
                        <td className="p-3" onClick={e => e.stopPropagation()}>
                          <div className="space-y-1">
                            <div className="flex items-center">
                              <span className="text-[9px] text-ink/40 mr-1">Wt</span>
                              <input
                                type="number" min="1" max="100" value={t.weight}
                                onChange={e => goalItem && handleUpdateTaskWeight(t.id, goalItem.id, parseFloat(e.target.value) || 1)}
                                className="w-10 px-1 py-0.5 text-[10px] bg-mist/30 rounded border border-transparent hover:border-mist focus:bg-paper focus:border-gold outline-none font-mono"
                              />
                              <span className="text-[10px] text-ink/40 ml-0.5">%</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${t.completed ? 'bg-sage/20 text-sage' : 'bg-gold/20 text-gold'}`}>
                            {t.completed ? 'Done' : 'Pending'}
                          </span>
                        </td>
                        <td className="p-3 text-xs text-ink/40 max-w-[200px] truncate">{t.reflection || '—'}</td>
                        <td className="p-3">
                          <button
                            onClick={(e) => handleDeleteTask(e, t.id)}
                            className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded-lg transition text-ink/30 hover:text-red-500"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {allTasks.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-ink/40">No deeds scheduled for today.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          {allTasks.filter(t => !t.startTime && !t.isHabit).length > 0 && viewMode === 'timeline' && (
            <div className="mt-6">
              <h3 className="text-sm font-bold text-ink/60 uppercase tracking-wider mb-3">Unscheduled</h3>
              <div className="space-y-2">
                {allTasks.filter(t => !t.startTime && !t.isHabit).map(t => {
                  const goalItem = dailyGoals.find(dg => (dg.tasks || []).some(tt => tt.id === t.id))
                  return (
                    <div
                      key={t.id}
                      onClick={() => handleOpenDeed(t)}
                      className={`w-full text-left px-4 py-3 rounded-xl border text-sm flex items-center space-x-3 transition-all group cursor-pointer ${t.completed ? 'glass border-sage/20 opacity-80' : 'bg-black/20 border-white/10 hover:border-gold hover:bg-black/40'}`}
                    >
                      <button onClick={(e) => { e.stopPropagation(); handleToggleTask(t) }} className="shrink-0">
                        {t.completed ? <CheckCircle2 className="w-4 h-4 text-sage" /> : <Circle className="w-4 h-4 text-ink/30" />}
                      </button>
                      <span className={`flex-1 ${t.completed ? 'line-through text-ink/50' : ''}`}>{t.title}</span>
                      <div className="flex items-center shrink-0 space-x-1" onClick={e => e.stopPropagation()}>
                        <input
                          type="number" min="1" max="100" value={t.weight}
                          onChange={e => goalItem && handleUpdateTaskWeight(t.id, goalItem.id, parseFloat(e.target.value) || 1)}
                          className="w-10 px-1 py-0.5 text-[10px] bg-transparent rounded border border-transparent hover:border-mist focus:bg-paper focus:border-gold outline-none text-right font-mono"
                        />
                        <span className="text-[10px] font-mono text-ink/40">%</span>
                      </div>
                      <button
                        onClick={(e) => handleDeleteTask(e, t.id)}
                        className="shrink-0 p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded transition text-ink/30 hover:text-red-500"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="xl:col-span-1">
          <div className="sticky top-6 space-y-6">
            <div className="flex items-center space-x-2 mb-4">
              <BookOpen className="w-5 h-5 text-gold" />
              <h2 className="text-2xl font-display font-bold text-ink">Day Reflection</h2>
            </div>
            <Card className="p-6">
              <textarea
                value={reflectionText}
                onChange={(e) => { setReflectionText(e.target.value); saveReflection(e.target.value) }}
                placeholder="Reflect on today..."
                className="w-full h-48 bg-black/20 border border-white/10 rounded-xl p-5 text-sm text-ink resize-none focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-ink/30 transition-all"
              />
              <p className="text-[10px] text-ink/40 mt-2">Auto-saves as you type</p>
            </Card>
            <Card className="p-6 space-y-4">
              <p className="text-xs font-bold uppercase text-ink/50">Today's Goals</p>
              {(() => {
                // Only show the primary daily goal (the one that actually has tasks, or the first one)
                const activeGoal = primaryGoal || dailyGoals[0]
                if (!activeGoal) return <p className="text-xs text-ink/40">No daily goals for this date.</p>
                return (
                  <div key={activeGoal.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-ink truncate">{activeGoal.title}</span>
                      <span className="font-mono text-xs text-ink/50">{Math.round(completionMap[activeGoal.id] || 0)}%</span>
                    </div>
                    <ProgressBar progress={completionMap[activeGoal.id] || 0} colorClass="bg-sage" />
                  </div>
                )
              })()}
            </Card>
            {primaryGoal && (
              <Card className="p-5 space-y-3">
                <p className="text-xs font-bold uppercase text-ink/50">Contributes To</p>
                {(() => {
                  const chain: Item[] = []
                  let current: Item | undefined = primaryGoal
                  while (current?.parentId) {
                    const parent = findItem(current.parentId)
                    if (parent) {
                      chain.push(parent)
                      current = parent
                    } else break
                  }
                  return chain.map(ancestor => (
                    <div key={ancestor.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${ancestor.layer === 0 ? 'bg-purple-100 text-purple-600' :
                          ancestor.layer === 1 ? 'bg-blue-100 text-blue-600' :
                            ancestor.layer === 2 ? 'bg-cyan-100 text-cyan-600' :
                              ancestor.layer === 3 ? 'bg-emerald-100 text-emerald-600' :
                                ancestor.layer === 4 ? 'bg-amber-100 text-amber-600' :
                                  'bg-rose-100 text-rose-600'
                          }`}>
                          {ancestor.layer === 0 ? 'Year' :
                            ancestor.layer === 1 ? 'Cat' :
                              ancestor.layer === 2 ? 'Annual' :
                                ancestor.layer === 3 ? 'Qtr' :
                                  ancestor.layer === 4 ? 'Month' :
                                    'Week'}
                        </span>
                        <span className="truncate text-ink/70">{ancestor.title}</span>
                      </div>
                      <span className="font-mono text-xs text-ink/40 shrink-0 ml-2">{Math.round(completionMap[ancestor.id] || 0)}%</span>
                    </div>
                  ))
                })()}
              </Card>
            )}
          </div>
        </div>
      </div>

      {showNoteModal && (
        <RichNoteModal
          onClose={() => { setShowNoteModal(false); setEditingNote(null) }}
          onSaved={() => { fetchDayNotes(); fetchItems() }}
          note={editingNote}
          defaultDate={dateStr}
        />
      )}

      {selectedDeed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fadeIn" onClick={() => setSelectedDeed(null)}>
          <div className="glass rounded-3xl border border-white/20 shadow-2xl shadow-black/50 w-full max-w-lg mx-4 animate-slideUp overflow-hidden" onClick={e => e.stopPropagation()} style={{ borderLeft: `6px solid var(--deed-color, #d4af37)` }}>
            {/* Color accent bar */}
            <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #d4af37, #8fbc8f, #6495ed, #ff7f50, #9370db)' }} />

            {/* Header */}
            <div className="px-7 pt-7 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <input
                    type="text"
                    value={selectedDeed.task.title}
                    onChange={e => {
                      const updated = { ...selectedDeed, task: { ...selectedDeed.task, title: e.target.value } }
                      setSelectedDeed(updated)
                    }}
                    placeholder="Deed title"
                    className="w-full text-2xl font-display font-bold text-ink bg-transparent border-b-2 border-transparent hover:border-white/20 focus:border-gold/50 focus:outline-none px-1 py-1 transition-all placeholder:text-ink/30"
                  />
                  <div className="flex items-center space-x-3 text-xs text-ink/50">
                    <button
                      onClick={() => {
                        const goalItem = dailyGoals.find(dg => (dg.tasks || []).some(t => t.id === selectedDeed.task.id))
                        if (goalItem) {
                          updateTask(goalItem.id, selectedDeed.task.id, { completed: !selectedDeed.task.completed })
                          setSelectedDeed({ ...selectedDeed, task: { ...selectedDeed.task, completed: !selectedDeed.task.completed } })
                        }
                      }}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${selectedDeed.task.completed
                        ? 'bg-sage/20 text-sage border border-sage/30'
                        : 'bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20'
                        }`}
                    >
                      {selectedDeed.task.completed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                      <span>{selectedDeed.task.completed ? 'Completed' : 'Mark Complete'}</span>
                    </button>
                    {selectedDeed.task.isFrog && (
                      <span className="flex items-center space-x-1 px-2 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full">
                        <Target className="w-3 h-3" />
                        <span>Frog</span>
                      </span>
                    )}
                    {selectedDeed.task.isHabit && (
                      <span className="flex items-center space-x-1 px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full">
                        <Repeat className="w-3 h-3" />
                        <span>Habit</span>
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => handleSaveDeedChanges()} className="p-2 hover:bg-white/10 rounded-xl transition text-ink/50 hover:text-ink" title="Close & save">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-7 pb-6 space-y-5 max-h-[60vh] overflow-y-auto">
              {/* Time section - Google Calendar style */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase text-ink/40 tracking-wider flex items-center space-x-2">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Date & Time</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-[9px] text-ink/40 font-bold uppercase">Date</label>
                    <div className="mt-1 px-3 py-2.5 bg-black/20 border border-white/10 rounded-xl text-sm text-ink/80 font-mono">
                      {format(currentDate, 'EEEE, MMMM d, yyyy')}
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] text-ink/40 font-bold uppercase">Start Time</label>
                    <input
                      type="time"
                      value={selectedDeed.task.startTime ? format(new Date(selectedDeed.task.startTime as string), 'HH:mm') : ''}
                      onChange={e => {
                        const [h, m] = e.target.value.split(':')
                        const newStart = selectedDeed.task.startTime ? new Date(selectedDeed.task.startTime as string) : new Date()
                        newStart.setHours(parseInt(h), parseInt(m))
                        setSelectedDeed({ ...selectedDeed, task: { ...selectedDeed.task, startTime: newStart.toISOString() } })
                      }}
                      className="w-full mt-1 px-3 py-2.5 text-sm font-mono bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 text-ink/80"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-ink/40 font-bold uppercase">End Time</label>
                    <input
                      type="time"
                      value={selectedDeed.task.endTime ? format(new Date(selectedDeed.task.endTime as string), 'HH:mm') : ''}
                      onChange={e => {
                        const [h, m] = e.target.value.split(':')
                        const newEnd = selectedDeed.task.endTime ? new Date(selectedDeed.task.endTime as string) : (selectedDeed.task.startTime ? new Date(selectedDeed.task.startTime as string) : new Date())
                        newEnd.setHours(parseInt(h), parseInt(m))
                        setSelectedDeed({ ...selectedDeed, task: { ...selectedDeed.task, endTime: newEnd.toISOString() } })
                      }}
                      className="w-full mt-1 px-3 py-2.5 text-sm font-mono bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 text-ink/80"
                    />
                  </div>
                  <div className="col-span-2 flex items-center space-x-2 pt-1">
                    <button
                      onClick={() => {
                        const now = new Date()
                        const start = new Date(now)
                        start.setMinutes(Math.floor(start.getMinutes() / 30) * 30)
                        const end = new Date(start)
                        end.setHours(end.getHours() + 1)
                        setSelectedDeed({ ...selectedDeed, task: { ...selectedDeed.task, startTime: start.toISOString(), endTime: end.toISOString() } })
                      }}
                      className="px-3 py-1 text-[10px] font-bold text-ink/50 border border-dashed border-white/20 rounded-lg hover:border-gold/50 hover:text-gold transition"
                    >
                      + Set to now
                    </button>
                    <button
                      onClick={() => setSelectedDeed({ ...selectedDeed, task: { ...selectedDeed.task, startTime: null as any, endTime: null as any } })}
                      className="px-3 py-1 text-[10px] font-bold text-ink/50 border border-dashed border-white/20 rounded-lg hover:border-coral/50 hover:text-coral transition"
                    >
                      Clear time
                    </button>
                  </div>
                </div>
              </div>

              {/* Details section */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase text-ink/40 tracking-wider flex items-center space-x-2">
                  <Target className="w-3.5 h-3.5" />
                  <span>Details</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] text-ink/40 font-bold uppercase">Weight</label>
                    <div className="flex items-center space-x-2 mt-1">
                      <input
                        type="range" min="1" max="100"
                        value={selectedDeed.task.weight}
                        onChange={e => {
                          const w = parseFloat(e.target.value)
                          setSelectedDeed({ ...selectedDeed, task: { ...selectedDeed.task, weight: w } })
                        }}
                        className="flex-1 h-1.5 bg-mist rounded-full appearance-none cursor-pointer accent-gold"
                      />
                      <input
                        type="number" min="1" max="100"
                        value={selectedDeed.task.weight}
                        onChange={e => {
                          const w = parseFloat(e.target.value) || 1
                          setSelectedDeed({ ...selectedDeed, task: { ...selectedDeed.task, weight: w } })
                        }}
                        className="w-14 px-1.5 py-1.5 text-xs font-mono bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30 text-ink/80 text-center"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] text-ink/40 font-bold uppercase">Progress</label>
                    <div className="flex items-center space-x-2 mt-1">
                      <input
                        type="range" min="0" max="100"
                        value={Math.round(selectedDeed.task.progress)}
                        onChange={e => {
                          const p = parseFloat(e.target.value)
                          setSelectedDeed({ ...selectedDeed, task: { ...selectedDeed.task, progress: p } })
                        }}
                        className="flex-1 h-1.5 bg-mist rounded-full appearance-none cursor-pointer accent-sage"
                      />
                      <span className="w-10 text-center text-xs font-mono text-sage font-bold">{Math.round(selectedDeed.task.progress)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Category / Color tag */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase text-ink/40 tracking-wider flex items-center space-x-2">
                  <span className="text-sm">🏷️</span>
                  <span>Category</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedDeed({ ...selectedDeed, task: { ...selectedDeed.task, categoryId: null as any } })}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border transition ${!selectedDeed.task.categoryId
                      ? 'bg-white/10 border-white/30 text-ink'
                      : 'border-white/10 text-ink/50 hover:border-white/30'
                      }`}
                  >
                    No tag
                  </button>
                  {activeCategories.map((cat, idx) => {
                    const catColors = ['#d4af37', '#8fbc8f', '#6495ed', '#ff7f50', '#9370db', '#3cb371', '#ffd700', '#00bfff']
                    const color = catColors[idx % catColors.length]
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedDeed({ ...selectedDeed, task: { ...selectedDeed.task, categoryId: cat.id } })}
                        className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border transition flex items-center space-x-1.5 ${selectedDeed.task.categoryId === cat.id
                          ? 'border-current text-ink'
                          : 'border-white/10 text-ink/50 hover:border-white/30'
                          }`}
                        style={selectedDeed.task.categoryId === cat.id ? { borderColor: color, backgroundColor: `${color}15`, color } : {}}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        <span>{cat.title}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Recurrence */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase text-ink/40 tracking-wider flex items-center space-x-2">
                  <Repeat className="w-3.5 h-3.5" />
                  <span>Repeat</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {['', 'daily', 'weekly', 'weekdays', 'monthly', 'yearly'].map(pattern => (
                    <button
                      key={pattern}
                      onClick={() => {
                        const isRecurring = pattern !== ''
                        setSelectedDeed({
                          ...selectedDeed,
                          task: {
                            ...selectedDeed.task,
                            isRecurring,
                            recurrencePattern: pattern || null as any,
                          }
                        })
                      }}
                      className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border transition ${(pattern === '' && !selectedDeed.task.isRecurring) || selectedDeed.task.recurrencePattern === pattern
                        ? 'bg-white/10 border-white/30 text-ink'
                        : 'border-white/10 text-ink/50 hover:border-white/30'
                        }`}
                    >
                      {pattern === '' ? 'Does not repeat' :
                        pattern === 'daily' ? 'Daily' :
                          pattern === 'weekly' ? 'Weekly' :
                            pattern === 'weekdays' ? 'Weekdays' :
                              pattern === 'monthly' ? 'Monthly' : 'Yearly'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reflection */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase text-ink/40 tracking-wider flex items-center space-x-2">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Reflection</span>
                </p>
                <textarea
                  value={deedReflection}
                  onChange={(e) => setDeedReflection(e.target.value)}
                  placeholder="What did you learn? How did it go?"
                  className="w-full h-28 bg-black/20 border border-white/10 rounded-xl p-4 text-sm text-ink resize-none focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-ink/30 transition-all"
                />
              </div>

              {/* Goal contribution */}
              {selectedDeed.parentGoal && (
                <div className="bg-gradient-to-r from-black/30 to-black/10 border border-white/10 rounded-xl p-4 space-y-2">
                  <p className="text-[9px] font-bold uppercase text-ink/40 tracking-wider">Contributes To</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-gold shrink-0" />
                      <span className="text-sm font-bold text-ink truncate">{selectedDeed.parentGoal.title}</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-gold">{Math.round(completionMap[selectedDeed.parentGoal.id] || 0)}%</span>
                  </div>
                  <ProgressBar progress={completionMap[selectedDeed.parentGoal.id] || 0} colorClass="bg-gold" />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-7 py-4 border-t border-white/10 bg-black/20 flex items-center justify-between">
              <button
                onClick={async (e) => {
                  await handleDeleteTask(e, selectedDeed.task.id)
                  setSelectedDeed(null)
                }}
                className="flex items-center space-x-1.5 px-3 py-2 text-xs text-coral hover:bg-coral/10 rounded-xl transition"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
              <div className="flex items-center space-x-3">
                <button onClick={() => setSelectedDeed(null)} className="px-5 py-2.5 text-sm font-bold text-ink/60 hover:text-ink hover:bg-white/5 rounded-xl transition">Cancel</button>
                <button onClick={handleSaveDeedChanges} className="px-6 py-2.5 bg-gold text-paper text-sm font-bold rounded-xl hover:bg-gold-glow transition-all active:scale-95 shadow-lg shadow-gold/20 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper function to trigger habit add
async function handleAddHabitViaInput() {
  const btn = document.getElementById('trigger-habit-add')
  if (btn) btn.click()
}