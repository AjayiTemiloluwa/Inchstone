'use client'

import { CheckCircle2, Circle, Trash2 } from 'lucide-react'
import type { Task } from '@/stores/hierarchyStore'

export function UnscheduledDeeds({
  tasks,
  onOpen,
  onToggle,
  onDelete,
  onWeightChange,
}: {
  tasks: Task[]
  onOpen: (task: Task) => void
  onToggle: (task: Task) => void
  onDelete: (e: React.MouseEvent, taskId: string) => void
  onWeightChange: (task: Task, weight: number) => void
}) {
  if (tasks.length === 0) return null
  return (
            <div className="mt-6">
              <h3 className="text-sm font-bold text-ink/60 uppercase tracking-wider mb-3">Unscheduled</h3>
              <div className="space-y-2">
                {tasks.map(t => {
                  return (
                    <div
                      key={t.id}
                      onClick={() => onOpen(t)}
                      className={`w-full text-left px-4 py-3 rounded-xl border text-sm flex items-center space-x-3 transition-all group cursor-pointer ${t.completed ? 'glass border-sage/20 opacity-80' : 'bg-black/20 border-white/10 hover:border-gold hover:bg-black/40'}`}
                    >
                      <button onClick={(e) => { e.stopPropagation(); onToggle(t) }} className="shrink-0">
                        {t.completed ? <CheckCircle2 className="w-4 h-4 text-sage" /> : <Circle className="w-4 h-4 text-ink/30" />}
                      </button>
                      <span className={`flex-1 min-w-0 break-words ${t.completed ? 'line-through text-ink/50' : ''}`}>{t.title}</span>
                      <div className="flex items-center shrink-0 space-x-1" onClick={e => e.stopPropagation()}>
                        <input
                          type="number" min="1" step="any" value={t.weight}
                          onChange={e => onWeightChange(t, parseFloat(e.target.value) || 1)}
                          className="w-14 px-1 py-0.5 text-[10px] bg-transparent rounded border border-transparent hover:border-mist focus:bg-paper focus:border-gold outline-none text-right font-mono"
                        />
                        <span className="text-[10px] font-mono text-ink/40">pts</span>
                      </div>
                      <button
                        onClick={(e) => onDelete(e, t.id)}
                        className="shrink-0 p-1 opacity-0 group-hover:opacity-100 hover:bg-ember/15 rounded transition text-ink/30 hover:text-[#cf8f78]"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
  )
}
