'use client'

import { useState } from 'react'
import { Item, Task } from '@/store/hierarchyStore'
import { useHierarchyStore } from '@/store/hierarchyStore'
import { format } from 'date-fns'
import { X, CheckCircle2, Circle, Plus, Trash2, Target, FileText, Sliders, Clock } from 'lucide-react'
import { Card } from '@/components/ui/Card'

interface DayPanelProps {
  date: Date
  deeds: Item[]
  onClose: () => void
  onRefresh: () => void
}

export function DayPanel({ date, deeds, onClose, onRefresh }: DayPanelProps) {
  const { updateItem, updateTask, completionMap } = useHierarchyStore()
  const [newTaskText, setNewTaskText] = useState('')
  const [newTaskTime, setNewTaskTime] = useState('')
  const [editingDeedId, setEditingDeedId] = useState<string | null>(null)
  const [reportText, setReportText] = useState('')
  const [editingWeight, setEditingWeight] = useState<string | null>(null)

  const totalTasks = deeds.reduce((sum, d) => sum + (d.tasks?.length || 0), 0)
  const completedTasks = deeds.reduce((sum, d) => sum + (d.tasks?.filter(t => t.completed).length || 0), 0)
  const dayScore = deeds.length > 0
    ? Math.round(deeds.reduce((sum, d) => sum + (completionMap[d.id] || 0), 0) / deeds.length)
    : 0

  const handleAddTask = async (deedId: string) => {
    if (!newTaskText.trim()) return
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deedId,
          title: newTaskText.trim(),
          date: date.toISOString(),
          scheduledTime: newTaskTime ? new Date(`${format(date, 'yyyy-MM-dd')}T${newTaskTime}`).toISOString() : null,
        })
      })
      if (res.ok) {
        setNewTaskText('')
        setNewTaskTime('')
        setEditingDeedId(null)
        onRefresh()
      }
    } catch (e) { console.error(e) }
  }

  const handleToggleTask = async (task: Task) => {
    updateTask(task.deedId, task.id, { completed: !task.completed, progress: task.completed ? 0 : 100 })
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !task.completed, progress: task.completed ? 0 : 100 })
      })
    } catch (e) { console.error(e) }
  }

  const handleDeleteTask = async (deedId: string, taskId: string) => {
    if (!confirm('Delete this task?')) return
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
      onRefresh()
    } catch (e) { console.error(e) }
  }

  const handleProgressChange = async (task: Task, progress: number) => {
    updateTask(task.deedId, task.id, { progress, completed: progress >= 100 })
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress, completed: progress >= 100 })
      })
    } catch (e) { console.error(e) }
  }

  const handleWeightChange = async (deedId: string, weight: number) => {
    updateItem(deedId, { weight })
  }

  const handleWeightEdit = async (changedDeedId: string, newWeight: number) => {
    const siblings = deeds.filter(d => d.id !== changedDeedId)
    const remainingWeight = Math.max(0, 100 - newWeight)
    const totalOtherWeight = siblings.reduce((sum, d) => sum + (d.weight || 1), 0)
    siblings.forEach(sibling => {
      const adjustedWeight = totalOtherWeight > 0
        ? (sibling.weight / totalOtherWeight) * remainingWeight
        : remainingWeight / siblings.length
      handleWeightChange(sibling.id, adjustedWeight)
    })
    handleWeightChange(changedDeedId, newWeight)
    onRefresh()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-mist">
          <div>
            <h2 className="text-2xl font-display font-bold text-ink">{format(date, 'EEEE, MMMM d, yyyy')}</h2>
            <p className="text-sm text-ink/60 mt-1">
              {deeds.length} deed{deeds.length !== 1 ? 's' : ''}
              {totalTasks > 0 && ` • ${completedTasks}/${totalTasks} tasks`}
              {deeds.length > 0 && ` • ${dayScore}% complete`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-mist rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Daily Score Bar */}
          {deeds.length > 0 && (
            <div className="p-4 bg-mist/30 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-ink/60 uppercase">Daily Progress</span>
                <span className="text-sm font-bold">{dayScore}%</span>
              </div>
              <div className="w-full h-3 bg-mist rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${dayScore >= 80 ? 'bg-sage' : dayScore >= 50 ? 'bg-gold' : 'bg-coral'}`}
                  style={{ width: `${dayScore}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5 text-[10px] text-ink/40">
                <span>{completedTasks} tasks done</span>
                <span>{totalTasks - completedTasks} remaining</span>
              </div>
            </div>
          )}

          {/* Deeds with tasks */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-ink flex items-center">
              <Target className="w-5 h-5 mr-2 text-gold" />
              Daily Deeds
            </h3>

            {deeds.map(deed => {
              const tasks = deed.tasks || []
              const deedPct = completionMap[deed.id] || 0
              const doneTasks = tasks.filter(t => t.completed).length

              return (
                <div key={deed.id} className="border border-mist rounded-xl overflow-hidden">
                  {/* Deed header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-paper border-b border-mist">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className={`w-2 h-2 rounded-full ${deedPct >= 100 ? 'bg-sage' : deedPct > 0 ? 'bg-gold' : 'bg-mist'}`} />
                      <div className="flex-1">
                        <span className="font-medium text-ink">{deed.title}</span>
                        {deed.category && (
                          <span className="ml-2 text-[10px] uppercase font-mono px-1.5 py-0.5 bg-mist rounded text-ink/60">
                            {deed.category}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      {/* Weight editor */}
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => setEditingWeight(editingWeight === deed.id ? null : deed.id)}
                          className="text-[10px] text-ink/40 hover:text-ink transition p-1"
                          title="Adjust weight"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-mono text-ink/50">{Math.round(deed.weight || 1)}%</span>
                      </div>
                      <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${deedPct >= 100 ? 'bg-sage/20 text-sage' : deedPct > 0 ? 'bg-gold/20 text-gold' : 'bg-mist text-ink/50'
                        }`}>
                        {Math.round(deedPct)}%
                      </span>
                    </div>
                  </div>

                  {/* Weight slider */}
                  {editingWeight === deed.id && (
                    <div className="px-4 py-2 bg-mist/20 border-b border-mist">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] text-ink/40 w-8">Weight:</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={deed.weight || 1}
                          onChange={e => handleWeightEdit(deed.id, parseFloat(e.target.value))}
                          className="flex-1 h-1.5"
                        />
                        <span className="text-xs font-mono text-ink w-10 text-right">{Math.round(deed.weight || 1)}%</span>
                      </div>
                    </div>
                  )}

                  {/* Deed progress bar */}
                  <div className="w-full h-1.5 bg-mist/50">
                    <div
                      className={`h-full transition-all ${deedPct >= 100 ? 'bg-sage' : 'bg-gold'}`}
                      style={{ width: `${deedPct}%` }}
                    />
                  </div>

                  {/* Tasks */}
                  <div className="px-4 py-2 space-y-0.5">
                    {tasks.map(task => (
                      <div key={task.id} className="flex items-center space-x-2 group py-1.5 px-2 rounded-lg hover:bg-mist/20 transition">
                        <button onClick={() => handleToggleTask(task)} className="shrink-0">
                          {task.completed ? (
                            <CheckCircle2 className="w-4 h-4 text-sage" />
                          ) : (
                            <Circle className="w-4 h-4 text-ink/30 group-hover:text-gold transition" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center">
                            <span className={`text-sm ${task.completed ? 'line-through text-ink/40' : 'text-ink'}`}>
                              {task.title}
                            </span>
                            {task.scheduledTime && (
                              <span className="ml-2 text-[10px] text-ink/40 font-mono">
                                <Clock className="w-3 h-3 inline mr-0.5" />
                                {format(new Date(task.scheduledTime), 'h:mm a')}
                              </span>
                            )}
                          </div>
                          {/* Progress slider for task */}
                          <div className="flex items-center space-x-2 mt-1">
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="5"
                              value={task.progress}
                              onChange={e => handleProgressChange(task, parseFloat(e.target.value))}
                              className="flex-1 h-1"
                            />
                            <span className="text-[10px] font-mono text-ink/50 w-8 text-right">{Math.round(task.progress)}%</span>
                          </div>
                        </div>
                        <button onClick={() => handleDeleteTask(deed.id, task.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-ink/30 hover:text-coral transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}

                    {/* Add task button/input */}
                    {editingDeedId === deed.id ? (
                      <div className="flex items-center space-x-2 mt-2">
                        <input
                          value={newTaskText}
                          onChange={e => setNewTaskText(e.target.value)}
                          placeholder="New task..."
                          className="flex-1 px-3 py-1.5 bg-paper border border-mist rounded-lg text-sm focus:outline-none focus:border-gold"
                          onKeyDown={e => { if (e.key === 'Enter') handleAddTask(deed.id) }}
                          autoFocus
                        />
                        <input
                          type="time"
                          value={newTaskTime}
                          onChange={e => setNewTaskTime(e.target.value)}
                          className="px-2 py-1.5 bg-paper border border-mist rounded-lg text-sm w-20 focus:outline-none focus:border-gold"
                        />
                        <button onClick={() => handleAddTask(deed.id)}
                          className="px-2 py-1.5 bg-gold text-surface rounded-lg text-sm hover:bg-gold/90 transition">
                          <Plus className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setEditingDeedId(null); setNewTaskText(''); setNewTaskTime('') }}
                          className="px-2 py-1.5 text-sm text-ink/50 hover:text-ink transition">
                          X
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingDeedId(deed.id)}
                        className="w-full mt-1 py-1.5 border border-dashed border-mist rounded-lg text-xs text-ink/40 hover:text-gold hover:border-gold transition flex items-center justify-center"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add task
                      </button>
                    )}
                  </div>
                </div>
              )
            })}

            {deeds.length === 0 && (
              <div className="text-center py-8 text-ink/40">
                <p className="text-sm">No deeds for this day</p>
                <p className="text-xs mt-1">Add a daily deed from the Year View to get started</p>
              </div>
            )}
          </div>

          {/* Daily Report */}
          <div>
            <h3 className="text-lg font-bold text-ink mb-3 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-sage" />
              Daily Reflection
            </h3>
            <Card className="h-40">
              <textarea
                value={reportText}
                onChange={e => setReportText(e.target.value)}
                className="w-full h-full bg-transparent resize-none focus:outline-none text-sm text-ink placeholder-ink/40"
                placeholder={`How was your day?\n- What went well?\n- What could be improved?\n- Key wins…`}
              />
            </Card>
          </div>

          {/* Weight legend */}
          <div className="text-[10px] text-ink/40 border-t border-mist pt-4">
            <p className="mb-1"><strong>Weight system:</strong> Each deed's % weight determines how much it contributes to higher-level goals.</p>
            <p>Default = equal split among siblings. Adjust via the slider icon.</p>
            <p>Changing one deed's weight auto-adjusts the others proportionally.</p>
          </div>
        </div>
      </div>
    </div>
  )
}