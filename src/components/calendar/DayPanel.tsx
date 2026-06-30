import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';

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

type Category = {
  id: string;
  title: string;
};

export function DayPanel({ date, categories }: { date: Date; categories: Category[] }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTask, setNewTask] = useState<Partial<Task>>({
    title: '',
    weight: 0,
    isRecurring: false
  });

  // Calculate total weight for adjustments
  const totalWeight = tasks.reduce((sum, task) => sum + task.weight, 0);

  // Automatically adjust weights to maintain 100% total
  useEffect(() => {
    if (totalWeight > 100) {
      const adjustedTasks = tasks.map(task => ({
        ...task,
        weight: Math.round((task.weight / totalWeight) * 100)
      }));
      setTasks(adjustedTasks);
    }
  }, [tasks, totalWeight]);

  const saveTask = () => {
    if (!newTask.title || !newTask.weight) return;

    const task: Task = {
      id: `task-${Date.now()}`,
      title: newTask.title,
      weight: Number(newTask.weight),
      categoryId: newTask.categoryId,
      startTime: newTask.startTime,
      endTime: newTask.endTime,
      isRecurring: newTask.isRecurring || false,
      recurrencePattern: newTask.recurrencePattern,
      recurrenceEnd: newTask.recurrenceEnd
    };

    setTasks([...tasks, task]);
    setIsModalOpen(false);
    setNewTask({ title: '', weight: 0, isRecurring: false });

    // TODO: Implement API call to save task to backend
  };

  const handleWeightChange = (taskId: string, newWeight: number) => {
    setTasks(tasks.map(task =>
      task.id === taskId ? { ...task, weight: newWeight } : task
    ));
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
        {tasks.map(task => (
          <div key={task.id} className="task-item p-3 border border-mist rounded-lg bg-surface">
            <div className="task-title font-semibold text-ink">{task.title}</div>
            <div className="task-meta text-xs text-ink/50">
              {task.startTime && `From ${task.startTime}`}
              {task.endTime && ` To ${task.endTime}`}
            </div>
            <div className="task-weight flex items-center space-x-2 mt-1">
              <input
                type="number"
                min="1"
                max="100"
                value={task.weight}
                onChange={(e) => handleWeightChange(task.id, Number(e.target.value))}
                className="w-16 px-2 py-1 text-sm bg-paper border border-mist rounded focus:outline-none focus:ring-2 focus:ring-gold/30"
              />
              <span className="text-xs text-ink/50">% weight</span>
            </div>
            {task.categoryId && (
              <div className="task-category mt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-gold/20 text-gold px-2 py-0.5 rounded">
                  {categories.find(c => c.id === task.categoryId)?.title || 'Uncategorized'}
                </span>
              </div>
            )}
          </div>
        ))}
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
                  {categories.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
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