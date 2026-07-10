'use client'

import { useState, useEffect } from 'react'
import { X, CheckCircle, Circle } from 'lucide-react'
import { useHierarchyStore, Item, Task } from '@/stores/hierarchyStore'
import { format } from 'date-fns'

interface DayModalProps {
    goalId: string
    onClose: () => void
}

export function DayModal({ goalId, onClose }: DayModalProps) {
    const { items, completionMap, updateItem, updateTask } = useHierarchyStore()
    const [goal, setGoal] = useState<Item | null>(null)

    useEffect(() => {
        // Find the goal in the tree
        const findGoal = (nodes: Item[]): Item | null => {
            for (const node of nodes) {
                if (node.id === goalId) return node
                if (node.children) {
                    const found = findGoal(node.children)
                    if (found) return found
                }
            }
            return null
        }
        setGoal(findGoal(items))
    }, [goalId, items])

    if (!goal) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm p-4">
                <div className="bg-paper w-full max-w-md rounded-2xl shadow-2xl p-6">
                    <p className="text-ink/60 text-center">Daily Goal not found.</p>
                    <button onClick={onClose} className="mt-4 w-full py-2 bg-ink text-surface rounded-lg">Close</button>
                </div>
            </div>
        )
    }

    const pct = completionMap[goalId] || 0
    const isCompleted = pct >= 100

    const handleGoalToggle = () => {
        updateItem(goalId, { completed: !isCompleted, progress: isCompleted ? 0 : 100 })
    }

    const handleTaskToggle = (task: Task) => {
        updateTask(goalId, task.id, { completed: !task.completed, progress: task.completed ? 0 : 100 })
    }

    const handleTaskWeightChange = (task: Task, weightStr: string) => {
        const val = parseFloat(weightStr)
        if (!isNaN(val)) {
            updateTask(goalId, task.id, { weight: val })
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm p-4">
            <div className="bg-paper w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-mist shrink-0">
                    <div>
                        <h3 className="font-bold text-ink">Daily Goal</h3>
                        <p className="text-xs text-ink/50 font-mono">Score: {Math.round(pct)}%</p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-mist rounded-full transition-colors">
                        <X className="w-5 h-5 text-ink/60" />
                    </button>
                </div>
                
                <div className="p-6 space-y-6 overflow-y-auto">
                    {/* Goal Header */}
                    <div className="flex items-start space-x-3">
                        <button onClick={handleGoalToggle} className="mt-0.5 shrink-0">
                            {isCompleted ? (
                                <CheckCircle className="w-6 h-6 text-sage" />
                            ) : (
                                <Circle className="w-6 h-6 text-ink/30 hover:text-gold transition-colors" />
                            )}
                        </button>
                        <div>
                            <p className={`font-semibold ${isCompleted ? 'line-through text-ink/50' : 'text-ink'}`}>
                                {goal.title}
                            </p>
                            <p className="text-xs font-mono text-ink/60 mt-1">Weight: {goal.weight}%</p>
                            {goal.startDate && (
                                <p className="text-xs text-ink/50 mt-1">
                                    {format(new Date(goal.startDate), 'EEEE, MMMM d, yyyy')}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Scheduled Tasks */}
                    <div>
                        <h4 className="text-sm font-bold text-ink/80 border-b border-mist pb-2 mb-3">Scheduled Tasks</h4>
                        <div className="space-y-3">
                            {goal.tasks && goal.tasks.length > 0 ? (
                                goal.tasks.map(task => (
                                    <div key={task.id} className="flex items-center space-x-3 bg-surface p-3 rounded-lg border border-mist">
                                        <button onClick={() => handleTaskToggle(task)} className="shrink-0">
                                            {task.completed ? (
                                                <CheckCircle className="w-5 h-5 text-sage" />
                                            ) : (
                                                <Circle className="w-5 h-5 text-ink/30 hover:text-gold transition-colors" />
                                            )}
                                        </button>
                                        <div className="flex-1">
                                            <p className={`text-sm ${task.completed ? 'line-through text-ink/50' : 'text-ink'}`}>
                                                {task.title}
                                            </p>
                                            <div className="flex gap-3 mt-1 text-[10px] text-ink/60 font-mono">
                                                {task.startTime && task.endTime && (
                                                    <span>{format(new Date(task.startTime), 'HH:mm')} - {format(new Date(task.endTime), 'HH:mm')}</span>
                                                )}
                                                {task.estimatedDuration && (
                                                    <span>{task.estimatedDuration} min</span>
                                                )}
                                            </div>
                                        </div>
                                        {/* Weight Configuration */}
                                        <div className="flex flex-col items-end shrink-0">
                                            <label className="text-[9px] uppercase tracking-wider text-ink/50 font-bold mb-1">Weight %</label>
                                            <input 
                                                type="number" 
                                                min="0" 
                                                max="100"
                                                defaultValue={task.weight}
                                                onBlur={(e) => handleTaskWeightChange(task, e.target.value)}
                                                className="w-16 p-1 text-xs text-right border border-mist rounded bg-paper"
                                            />
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-ink/50 italic">No scheduled tasks for this goal.</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end p-4 border-t border-mist shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-ink/70 hover:text-ink transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}
