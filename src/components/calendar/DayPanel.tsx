import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { Button, Modal, Select, TimePicker } from 'antd';

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
    <div className="day-panel">
      <div className="day-header">
        <h3>{format(date, 'EEEE, MMMM d, yyyy')}</h3>
        <Button
          type="primary"
          onClick={() => setIsModalOpen(true)}
        >
          Add Task
        </Button>
      </div>

      <div className="tasks-list">
        {tasks.map(task => (
          <div key={task.id} className="task-item">
            <div className="task-title">{task.title}</div>
            <div className="task-meta">
              {task.startTime && `From ${task.startTime}`}
              {task.endTime && `To ${task.endTime}`}
            </div>
            <div className="task-weight">
              <input
                type="number"
                min="1"
                max="100"
                value={task.weight}
                onChange={(e) => handleWeightChange(task.id, Number(e.target.value))}
              />
              <span>% weight</span>
            </div>
            {task.categoryId && (
              <div className="task-category">
                {categories.find(c => c.id === task.categoryId)?.title || 'Uncategorized'}
              </div>
            )}
          </div>
        ))}
      </div>

      <Modal
        title="Add New Task"
        visible={isModalOpen}
        onOk={saveTask}
        onCancel={() => setIsModalOpen(false)}
      >
        <div className="task-form">
          <div>
            <label>Title</label>
            <input
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              placeholder="Task title"
            />
          </div>

          <div>
            <label>Weight (1-100)</label>
            <input
              type="number"
              min="1"
              max="100"
              value={newTask.weight || ''}
              onChange={(e) => setNewTask({ ...newTask, weight: Number(e.target.value) })}
            />
          </div>

          <div>
            <label>Category</label>
            <Select
              style={{ width: '100%' }}
              placeholder="Select category"
              options={categories.map(c => ({ value: c.id, label: c.title }))}
              onChange={(value) => setNewTask({ ...newTask, categoryId: value })}
            />
          </div>

          <div>
            <label>Time Range</label>
            <div className="time-range">
              <TimePicker
                placeholder="Start time"
                format="HH:mm"
                onChange={(time, timeString) => setNewTask({ ...newTask, startTime: timeString })}
              />
              <TimePicker
                placeholder="End time"
                format="HH:mm"
                onChange={(time, timeString) => setNewTask({ ...newTask, endTime: timeString })}
              />
            </div>
          </div>

          <div>
            <label>
              <input
                type="checkbox"
                checked={newTask.isRecurring || false}
                onChange={(e) => setNewTask({ ...newTask, isRecurring: e.target.checked })}
              />
              Recurring Task
            </label>
          </div>

          {newTask.isRecurring && (
            <div>
              <label>Recurrence Pattern</label>
              <Select
                style={{ width: '100%' }}
                placeholder="Select pattern"
                options={[
                  { value: 'daily', label: 'Daily' },
                  { value: 'weekly', label: 'Weekly' },
                  { value: 'monthly', label: 'Monthly' }
                ]}
                onChange={(value) => setNewTask({ ...newTask, recurrencePattern: value })}
              />

              <label>End Date (optional)</label>
              <input
                type="date"
                onChange={(e) => setNewTask({ ...newTask, recurrenceEnd: e.target.value })}
              />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}