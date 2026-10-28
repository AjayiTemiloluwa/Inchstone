'use client'

import { format } from 'date-fns'
import { CheckCircle2, Circle, Plus, Target, Trash2 } from 'lucide-react'
import type { Task } from '@/stores/hierarchyStore'
import { Card } from '@/components/ui/Card'
import { Scramble } from '@/components/ui/motion'

export function FrogCard({
  frogTasks,
  onAdd,
  onToggle,
  onDelete,
}: {
  frogTasks: Task[]
  onAdd: () => void
  onToggle: (task: Task) => void
  onDelete: (e: React.MouseEvent, taskId: string) => void
}) {
  return (
          <Card className="p-4 sm:p-5 border border-gold/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-gold" />
                <h3 className="font-display font-bold text-ink"><Scramble text="Eat That Frog" mono={false} /></h3>
              </div>
              <button onClick={() => onAdd()} className="px-2.5 py-1 text-[11px] font-medium bg-gold/10 text-gold rounded-lg border border-gold/30 hover:bg-gold/20 transition flex items-center gap-1">
                <Plus className="w-3 h-3" />
                <span>Add</span>
              </button>
            </div>
            {frogTasks.length === 0 ? (
              <p className="text-xs text-ink/40 py-2">No frogs yet. Highlight your hardest task of the day.</p>
            ) : (
              <div className="space-y-2">
                {frogTasks.map((task, idx) => (
                  <div key={task.id} className={`flex flex-wrap items-center gap-x-2.5 gap-y-1.5 p-2.5 rounded-xl border transition-all sm:flex-nowrap sm:gap-3 ${task.completed ? 'glass border-sage/30 bg-sage/5 opacity-80' : 'bg-black/20 border-white/10 hover:border-gold/50'}`}>
                    <button onClick={() => onToggle(task)} className="shrink-0">
                      {task.completed ? <CheckCircle2 className="w-4 h-4 text-sage" /> : <Circle className="w-4 h-4 text-ink/30" />}
                    </button>
                    <span className="text-[9px] font-bold text-gold bg-gold/10 px-2 py-0.5 rounded-full shrink-0 uppercase">Frog #{idx + 1}</span>
                    <span className={`min-w-[120px] flex-[1_1_160px] break-words text-sm font-medium leading-snug sm:min-w-0 sm:flex-1 ${task.completed ? 'line-through text-ink/50' : 'text-ink'}`}>{task.title}</span>
                    {task.startTime && <span className="text-[10px] font-mono text-ink/40 shrink-0">{format(new Date(task.startTime), 'h:mm a')}</span>}
                    <button onClick={(e) => onDelete(e, task.id)} className="p-1 hover:bg-ember/15 rounded-lg transition text-ink/30 hover:text-[#cf8f78] shrink-0" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
  )
}
