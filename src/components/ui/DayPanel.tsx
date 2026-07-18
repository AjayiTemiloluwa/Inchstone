import { useState, useEffect } from 'react';
import { format, startOfYear, differenceInDays } from 'date-fns';
import { useHierarchyStore, Item } from '@/stores/hierarchyStore'
import { Plus } from 'lucide-react'

type Task = {
  id: string;
  title: string;
  weight: number;
  categoryId?: string;
  startTime?: string;
  endTime?: string;
  isRecurring: boolean;
  recurrencePattern?: 'daily' | 'weekly' | 'monthly';
  recurrenceEnd?: string;
};

export function DayPanel({ date, deeds, onClose, onRefresh }: { date: Date; deeds: Item[]; onClose: () => void; onRefresh: () => void }) {
  const { updateItem } = useHierarchyStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTask, setNewTask] = useState<Partial<Task>>({
    title: '',
    weight: 0,
    isRecurring: false
  });

  const totalWeight = deeds.reduce((sum, d) => sum + (d.weight || 0), 0);

  const saveTask = async () => {
    if (!newTask.title || !newTask.weight || deeds.length === 0) return;

    const parentDeed = deeds[0];
    const startTimeISO = newTask.startTime ? new Date(`${format(date, 'yyyy-MM-dd')}T${newTask.startTime}:00`).toISOString() : null
    const endTimeISO = newTask.endTime ? new Date(`${format(date, 'yyyy-MM-dd')}T${newTask.endTime}:00`).toISOString() : null

    const existingTasks = parentDeed.tasks || []
    const totalExistingWeight = existingTasks.reduce((sum, t) => sum + t.weight, 0)
    const remaining = Math.max(0, 100 - totalExistingWeight)
    const calculatedWeight = existingTasks.length > 0 ? remaining / (existingTasks.length + 1) : 100
    const finalWeight = calculatedWeight > 0 ? calculatedWeight : 1

    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goalId: parentDeed.id,
        title: newTask.title.trim(),
        date: format(date, 'yyyy-MM-dd'),
        startTime: startTimeISO,
        endTime: endTimeISO,
        weight: finalWeight,
        categoryId: newTask.categoryId || null,
      })
    })

    setIsModalOpen(false);
    setNewTask({ title: '', weight: 0, isRecurring: false });
    onRefresh();
  };

  const handleWeightChange = async (taskId: string, newWeight: number) => {
    const parentDeed = deeds[0]
    if (!parentDeed) return

    await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight: newWeight })
    })
    onRefresh()
  };

  return (
    <div className="day-panel space-y-4">
      {/* Mobile-optimized header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-ink">{format(date, 'EEEE, MMMM d, yyyy')}</h3>
          <p className="text-xs text-ink/50 mt-0.5">Day {differenceInDays(date, startOfYear(date)) + 1} of 365</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 bg-gold text-surface text-sm font-semibold rounded-xl hover:bg-gold-glow active:scale-95 transition-all shadow-lg shadow-gold/20 touch-manipulation min-h-[44px]"
        >
          Add Task
        </button>
      </div>

      {/* Tasks List - Mobile optimized with touch-friendly interactions */}
      <div className="tasks-list space-y-3">
        {deeds.map(deed => {
          const tasks = deed.tasks || []
          const pct = 0 // no completionMap here; kept minimal

          return (
            <div key={deed.id} className="task-item p-4 border border-mist rounded-xl bg-surface active:bg-surface/80 transition-all">
              {/* Task header with swipe hint */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-gold shrink-0" />
                  <div className="font-semibold text-ink truncate">{deed.title}</div>
                </div>
                <span className="text-[11px] font-mono text-gold font-bold bg-gold/10 px-2 py-1 rounded-lg shrink-0 ml-2">
                  {Math.round(deed.weight || 0)}%
                </span>
              </div>

              {/* Task list with improved spacing */}
              <div className="space-y-2">
                {tasks.map(task => (
                  <div key={task.id} className="flex items-center justify-between py-2.5 border-t border-mist/40 active:bg-mist/20 transition-colors -mx-1 px-1 rounded-lg">
                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-ink/20 shrink-0" />
                      <div className="text-sm text-ink truncate">{task.title}</div>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0 ml-2">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={task.weight}
                        onChange={(e) => handleWeightChange(task.id, Number(e.target.value))}
                        className="w-14 px-2 py-1.5 text-xs bg-paper border border-mist rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30 text-center font-medium touch-manipulation"
                      />
                      <span className="text-[10px] text-ink/40 font-medium">%</span>
                    </div>
                  </div>
                ))}
              </div>

              {tasks.length === 0 && (
                <div className="text-[11px] text-ink/40 italic mt-3 flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-dashed border-ink/20 rounded-full flex items-center justify-center">
                    <Plus className="w-2.5 h-2.5 text-ink/30" />
                  </div>
                  <span>No tasks yet</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fadeIn" onClick={() => setIsModalOpen(false)}>
          <div className="bg-surface rounded-2xl border border-mist shadow-2xl p-6 w-full max-w-md mx-4 animate-slideUp" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-ink text-lg">Add New Task</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-mist rounded-lg transition text-ink/30 hover:text-ink">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="task-form space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-ink/50 mb-1.5">Task Title</label>
                <input
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Enter task description..."
                  className="w-full px-4 py-3 text-sm bg-paper border border-mist rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/30 transition-all"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-ink/50 mb-1.5">Weight %</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={newTask.weight || ''}
                  onChange={(e) => setNewTask({ ...newTask, weight: Number(e.target.value) })}
                  placeholder="1-100"
                  className="w-full px-4 py-3 text-sm bg-paper border border-mist rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/30 transition-all"
                />
                <p className="text-[10px] text-ink/40 mt-1">Percentage weight for this task</p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-ink/50 mb-1">Category</label>
                <select
                  value={newTask.categoryId || ''}
                  onChange={(e) => setNewTask({ ...newTask, categoryId: e.target.value || undefined })}
                  className="w-full px-3 py-2 text-sm bg-paper border border-mist rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30"
                >
                  <option value="">Select category</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-ink/50 mb-1.5">Time Range (optional)</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="time"
                    value={newTask.startTime || ''}
                    onChange={(e) => setNewTask({ ...newTask, startTime: e.target.value })}
                    className="flex-1 px-3 py-3 text-sm bg-paper border border-mist rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 transition-all"
                  />
                  <span className="text-ink/30 font-bold">→</span>
                  <input
                    type="time"
                    value={newTask.endTime || ''}
                    onChange={(e) => setNewTask({ ...newTask, endTime: e.target.value })}
                    className="flex-1 px-3 py-3 text-sm bg-paper border border-mist rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={newTask.isRecurring || false}
                    onChange={(e) => setNewTask({ ...newTask, isRecurring: e.target.checked })}
                    className="w-4 h-4 text-gold border-mist rounded focus:ring-gold"
                  />
                  <span className="text-sm text-ink">Recurring Task</span>
                </label>
              </div>

              {newTask.isRecurring && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-ink/50 mb-1">Recurrence Pattern</label>
                    <select
                      value={newTask.recurrencePattern || ''}
                      onChange={(e) => setNewTask({ ...newTask, recurrencePattern: e.target.value as 'daily' | 'weekly' | 'monthly' })}
                      className="w-full px-3 py-2 text-sm bg-paper border border-mist rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30"
                    >
                      <option value="">Select pattern</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-ink/50 mb-1">End Date (optional)</label>
                    <input
                      type="date"
                      value={newTask.recurrenceEnd || ''}
                      onChange={(e) => setNewTask({ ...newTask, recurrenceEnd: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-paper border border-mist rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-mist/50">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-medium text-ink/60 hover:text-ink active:scale-95 transition-all min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  onClick={saveTask}
                  className="px-5 py-2.5 bg-gold text-surface text-sm font-bold rounded-xl hover:bg-gold-glow active:scale-95 transition-all shadow-lg shadow-gold/20 min-h-[44px]"
                >
                  Save Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
