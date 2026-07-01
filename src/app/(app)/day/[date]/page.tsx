'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useHierarchyStore, Item, Task } from '@/store/hierarchyStore'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useRouter, useParams } from 'next/navigation'
import { ChevronRight, BookOpen, Plus, X, CheckCircle2, Circle, Clock, Target, Trash2, StickyNote, Repeat } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import dynamic from 'next/dynamic'

const RichNoteModal = dynamic(() => import('@/components/items/RichNoteModal').then(mod => mod.RichNoteModal), { ssr: false })
import { useToast } from '@/components/ui/ToastProvider'

type DeedModalData = {
  task: Task
  parentGoal: Item | null
}

export default function DayPage() {
  const router = useRouter()
  const params = useParams()
  const dateStr = params.date as string

  const { items, completionMap, setItems, updateItem, updateTask } = useHierarchyStore()
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
  const [dayNotes, setDayNotes] = useState<any[]>([])
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [editingNote, setEditingNote] = useState<any>(null)

  const categories = items.filter(i => i.layer === 1)
  const currentDate = parseISO(dateStr)
  const [nowLineTop, setNowLineTop] = useState<number | null>(null)
  const prevAddingDeed = useRef(addingDeed)

  const findDailyGoalsForDate = (): Item[] => {
    const result: Item[] = []
    const search = (nodes: Item[]) => {
      nodes.forEach(n => {
        if (n.layer === 6 && n.startDate) {
          const goalDateStr = typeof n.startDate === 'string'
            ? n.startDate.substring(0, 10)
            : new Date(n.startDate).toISOString().substring(0, 10)
          if (goalDateStr === dateStr) result.push(n)
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

  const fetchItems = useCallback(() => {
    fetch('/api/items')
      .then(res => res.json())
      .then(data => {
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
      })
      .finally(() => setLoading(false))
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

  const allTasks: Task[] = dailyGoals.flatMap(dg => dg.tasks || [])
  const completedTasks = allTasks.filter(t => t.completed)
  const totalWeight = allTasks.reduce((sum, t) => sum + t.weight, 0)
  const dayScore = totalWeight > 0
    ? allTasks.reduce((sum, t) => sum + (t.completed ? t.weight : 0), 0) / totalWeight * 100
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
    const goalItem = dailyGoals.find(dg => (dg.tasks || []).some(t => t.id === task.id))
    if (!goalItem) return
    updateTask(goalItem.id, task.id, { completed: !task.completed })
  }

  const handleOpenDeed = (task: Task) => {
    const goalItem = dailyGoals.find(dg => (dg.tasks || []).some(t => t.id === task.id))
    const parentWeekly = goalItem?.parentId ? findItem(goalItem.parentId) : null
    setSelectedDeed({ task, parentGoal: parentWeekly || null })
    setDeedReflection(task.reflection || '')
  }

  const handleSaveDeedReflection = () => {
    if (!selectedDeed) return
    const goalItem = dailyGoals.find(dg => (dg.tasks || []).some(t => t.id === selectedDeed.task.id))
    if (goalItem) updateTask(goalItem.id, selectedDeed.task.id, { reflection: deedReflection })
    setSelectedDeed(null)
  }

  const handleDeleteTask = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation()
    if (!(await confirm('Delete this deed?'))) return
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
      if (!res.ok) {
        showToast('Failed to delete deed', 'error')
      } else {
        fetchItems()
        showToast('Deed deleted', 'success')
      }
    } catch (e) {
      console.error(e)
      showToast('Network error', 'error')
    }
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

  const handleAddDeed = async () => {
    if (!newDeedTitle.trim()) return
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
          title: newDeedTitle.trim(),
          date: dateStr,
          startTime: startTimeISO,
          endTime: endTimeISO,
          weight: finalWeight,
          categoryId: newDeedCategory || null,
          isRecurring: isRecurring,
          recurrencePattern: isRecurring ? recurrencePattern : null,
          recurrenceEnd: isRecurring && recurrenceEnd ? new Date(recurrenceEnd).toISOString() : null,
          isFrog: isFrog,
          isHabit: isHabit,
        })
      })
      const resData = await res.json()
      if (!res.ok) {
        showToast(`Failed to save task: ${resData.error || 'Unknown error'}`, 'error')
        return
      }
      fetchItems()
      showToast('Deed added', 'success')
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
      setAddingDeed(false)
    } catch (e) {
      console.error('Error adding deed:', e)
      showToast('An error occurred while saving the task.', 'error')
    }
  }

  const hours = Array.from({ length: 24 }, (_, i) => i)

  const formatHourLabel = (hour: number): string => {
    if (hour === 0) return '12 AM'
    if (hour < 12) return `${hour} AM`
    if (hour === 12) return '12 PM'
    return `${hour - 12} PM`
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
              <p className="text-xl font-mono font-bold">{completedTasks.length}/{allTasks.length}</p>
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
              <p className="text-xs text-ink/60 mt-1">Your top 3 most important tasks to crush before 10 AM.</p>
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
            {allTasks.filter(t => t.isFrog).map(task => {
              const goalItem = dailyGoals.find(dg => (dg.tasks || []).some(tt => tt.id === task.id))
              return (
                <div key={task.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${task.completed ? 'glass border-sage/30 bg-sage/5 opacity-80 text-ink/50' : 'bg-black/20 border-white/10 hover:border-gold/50'}`}>
                  <div className="flex items-center space-x-3">
                    <button onClick={() => handleToggleTask(task)} className="shrink-0">
                      {task.completed ? <CheckCircle2 className="w-5 h-5 text-sage" /> : <Circle className="w-5 h-5 text-ink/30" />}
                    </button>
                    <span className={`font-bold ${task.completed ? 'line-through' : 'text-ink'}`}>{task.title}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    {task.startTime && <span className="text-[10px] font-mono text-ink/40">{format(new Date(task.startTime), 'h:mm a')}</span>}
                    <button onClick={(e) => handleDeleteTask(e, task.id)} className="p-1.5 hover:bg-red-500/10 rounded-lg transition text-ink/30 hover:text-red-500" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
            {allTasks.filter(t => t.isFrog).length === 0 && (
              <p className="text-xs text-ink/40 py-2">No frogs designated for today. Identify your hardest task!</p>
            )}
          </div>
        </div>
      </Card>

      {/* Habit Tracker Section */}
      <Card className="p-5 border border-gold/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Repeat className="w-24 h-24 text-gold" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-display font-bold text-ink flex items-center space-x-2">
                <span className="text-2xl">🌱</span>
                <span>Habit Tracker</span>
              </h2>
              <p className="text-xs text-ink/60 mt-1">Daily recurring actions that build up to your yearly goals.</p>
            </div>
            <button
              onClick={() => { setIsHabit(true); setIsRecurring(true); setRecurrencePattern('daily'); setAddingDeed(true) }}
              className="px-3 py-1.5 text-xs font-medium bg-gold/10 text-gold rounded-lg border border-gold/30 hover:bg-gold/20 transition flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Habit</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {allTasks.filter(t => t.isHabit).map(task => {
              const goalItem = dailyGoals.find(dg => (dg.tasks || []).some(tt => tt.id === task.id))
              return (
                <div key={task.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${task.completed ? 'glass border-sage/30 bg-sage/5 opacity-80 text-ink/50' : 'bg-black/20 border-white/10 hover:border-gold/50'}`}>
                  <div className="flex items-center space-x-3 truncate">
                    <button onClick={() => handleToggleTask(task)} className="shrink-0">
                      {task.completed ? <CheckCircle2 className="w-5 h-5 text-sage" /> : <Circle className="w-5 h-5 text-ink/30" />}
                    </button>
                    <span className={`font-bold truncate ${task.completed ? 'line-through' : 'text-ink'}`}>{task.title}</span>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    <button onClick={(e) => handleDeleteTask(e, task.id)} className="p-1.5 hover:bg-red-500/10 rounded-lg transition text-ink/30 hover:text-red-500" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
            {allTasks.filter(t => t.isHabit).length === 0 && (
              <p className="text-xs text-ink/40 py-2 col-span-full">No habits tracked today. Build consistency!</p>
            )}
          </div>
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
              <option value="">No tag</option>
              {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.title}</option>)}
            </select>
            <div className="flex space-x-2">
              <input type="number" value={newDeedWeight} onChange={e => setNewDeedWeight(e.target.value)}
                min="1" max="100" placeholder="Wt"
                className="w-16 px-3 py-2.5 text-sm bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 text-ink/80" />
              <button onClick={handleAddDeed} className="flex-1 px-4 py-2.5 bg-gold text-paper text-sm font-bold rounded-xl hover:bg-gold-glow transition-all active:scale-95 shadow-lg shadow-gold/20">Add</button>
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
                <span>Habit</span>
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
                  const goalItem = dailyGoals.find(dg => (dg.tasks || []).some(tt => tt.id === task.id))
                  return (
                    <div
                      key={task.id}
                      onClick={(e) => { e.stopPropagation(); handleOpenDeed(task) }}
                      className={`absolute rounded-xl border p-2.5 text-left text-xs flex flex-col justify-between transition-all hover:shadow-lg cursor-pointer group/task select-none overflow-hidden task-block ${task.completed ? 'glass border-sage/30 text-ink/50 opacity-80' : 'glass-gold border-gold/30 text-ink hover:border-gold hover:-translate-y-0.5'}`}
                      style={{ top: `${top + 2}px`, height: `${height - 4}px`, left: `${left}%`, width: `${width}%`, zIndex: 10 }}
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
                    const goalItem = dailyGoals.find(dg => (dg.tasks || []).some(tt => tt.id === t.id))
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
          {allTasks.filter(t => !t.startTime).length > 0 && viewMode === 'timeline' && (
            <div className="mt-6">
              <h3 className="text-sm font-bold text-ink/60 uppercase tracking-wider mb-3">Unscheduled</h3>
              <div className="space-y-2">
                {allTasks.filter(t => !t.startTime).map(t => {
                  const goalItem = dailyGoals.find(dg => (dg.tasks || []).some(tt => tt.id === t.id))
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleOpenDeed(t)}
                      className={`w-full text-left px-4 py-3 rounded-xl border text-sm flex items-center space-x-3 transition-all group ${t.completed ? 'glass border-sage/20 opacity-80' : 'bg-black/20 border-white/10 hover:border-gold hover:bg-black/40'}`}
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
                    </button>
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
              {dailyGoals.map(dg => (
                <div key={dg.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-ink truncate">{dg.title}</span>
                    <span className="font-mono text-xs text-ink/50">{Math.round(completionMap[dg.id] || 0)}%</span>
                  </div>
                  <ProgressBar progress={completionMap[dg.id] || 0} colorClass="bg-sage" />
                </div>
              ))}
              {dailyGoals.length === 0 && (
                <p className="text-xs text-ink/40">No daily goals for this date.</p>
              )}
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
          <div className="glass rounded-3xl border border-white/20 shadow-2xl shadow-black/50 w-full max-w-lg mx-4 p-8 space-y-6 animate-slideUp" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-display font-bold text-ink">{selectedDeed.task.title}</h3>
              <button onClick={() => setSelectedDeed(null)} className="p-2 hover:bg-white/10 rounded-xl transition text-ink/50 hover:text-ink">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center space-x-4">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${selectedDeed.task.completed ? 'bg-sage/20 text-sage' : 'bg-gold/20 text-gold'}`}>
                {selectedDeed.task.completed ? 'Completed' : 'Pending'}
              </span>
              <span className="text-xs font-mono text-ink/50">Weight: {selectedDeed.task.weight}%</span>
              {selectedDeed.task.startTime && (
                <span className="text-xs font-mono text-ink/40">
                  {format(new Date(selectedDeed.task.startTime), 'h:mm a')}
                  {selectedDeed.task.endTime && `–${format(new Date(selectedDeed.task.endTime), 'h:mm a')}`}
                </span>
              )}
            </div>
            {selectedDeed.parentGoal && (
              <div className="bg-black/20 border border-white/10 rounded-xl p-4">
                <p className="text-[10px] font-bold uppercase text-ink/40 mb-1">Contributing to Goal</p>
                <p className="text-sm font-bold text-ink">{selectedDeed.parentGoal.title}</p>
                <ProgressBar progress={completionMap[selectedDeed.parentGoal.id] || 0} colorClass="bg-gold" className="mt-3" />
              </div>
            )}
            <div>
              <p className="text-xs font-bold uppercase text-ink/50 mb-3">Deed Reflection</p>
              <textarea
                value={deedReflection}
                onChange={(e) => setDeedReflection(e.target.value)}
                placeholder="Reflect on this deed..."
                className="w-full h-32 bg-black/20 border border-white/10 rounded-xl p-4 text-sm text-ink resize-none focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-ink/30 transition-all"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button onClick={() => setSelectedDeed(null)} className="px-5 py-2.5 text-sm font-bold text-ink/60 hover:text-ink hover:bg-white/5 rounded-xl transition">Cancel</button>
              <button onClick={handleSaveDeedReflection} className="px-5 py-2.5 bg-gold text-paper text-sm font-bold rounded-xl hover:bg-gold-glow transition-all active:scale-95 shadow-lg shadow-gold/20">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}