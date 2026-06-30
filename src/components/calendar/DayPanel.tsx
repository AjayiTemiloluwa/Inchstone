import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useHierarchyStore, Item } from '@/store/hierarchyStore'

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
      <div className="day-header flex items-center justify-between">
        <h3 className="text-lg font-bold text-ink">{format(date, 'EEEE, MMMM d, yyyy')}</h3>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-gold text-surface text-sm font-semibold rounded-lg hover:bg-gold/90 transition"
        >
          Add Task
        </button>
      </div>

      <div className="tasks-list space-y-2">
        {deeds.map(deed => {
          const tasks = deed.tasks || []
          const pct = 0 // no completionMap here; kept minimal
          return (
            <div key={deed.id} className="task-item p-3 border border-mist rounded-lg bg-surface">
              <div className="flex items-center justify-between mb-1">
                <div className="font-semibold text-ink truncate pr-4">{deed.title}</div>
                <span className="text-[10px] font-mono text-ink/50">{Math.round(deed.weight || 0)}%</span>
              </div>
              {tasks.map(task => (
                <div key={task.id} className="flex items-center justify-between py-1 border-t border-mist/40">
                  <div className="text-sm text-ink truncate pr-2">{task.title}</div>
                  <div className="flex items-center space-x-1">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={task.weight}
                      onChange={(e) => handleWeightChange(task.id, Number(e.target.value))}
                      className="w-12 px-1 py-0.5 text-xs bg-paper border border-mist rounded focus:outline-none focus:ring-2 focus:ring-gold/30"
                    />
                    <span className="text-[10px] text-ink/40">%</span>
                  </div>
                </div>
              ))}
              {tasks.length === 0 && (
                <div className="text-[11px] text-ink/40 italic mt-1">No tasks yet</div>
              )}
            </div>
          )
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setIsModalOpen(false)}>
          <div className="bg-surface rounded-2xl border border-mist shadow-xl p-5 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
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
                <label className="block text-xs font-bold uppercase text-ink/50 mb-1">Title</label>
                <input
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Task title"
                  className="w-full px-3 py-2 text-sm bg-paper border border-mist rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-ink/50 mb-1">Weight (1-100)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={newTask.weight || ''}
                  onChange={(e) => setNewTask({ ...newTask, weight: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm bg-paper border border-mist rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30"
                />
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
                <label className="block text-xs font-bold uppercase text-ink/50 mb-1">Time Range</label>
                <div className="time-range flex space-x-2">
                  <input
                    type="time"
                    value={newTask.startTime || ''}
                    onChange={(e) => setNewTask({ ...newTask, startTime: e.target.value })}
                    className="flex-1 px-3 py-2 text-sm bg-paper border border-mist rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30"
                  />
                  <input
                    type="time"
                    value={newTask.endTime || ''}
                    onChange={(e) => setNewTask({ ...newTask, endTime: e.target.value })}
                    className="flex-1 px-3 py-2 text-sm bg-paper border border-mist rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30"
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

              <div className="flex justify-end space-x-3 pt-2">
                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-ink/60 hover:text-ink transition">Cancel</button>
                <button onClick={saveTask} className="px-4 py-2 bg-gold text-surface text-sm font-semibold rounded-lg hover:bg-gold/90 transition">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
