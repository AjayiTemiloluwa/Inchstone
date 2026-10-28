'use client'

import { format } from 'date-fns'
import { CheckCircle2, Circle, Trash2 } from 'lucide-react'
import type { Task } from '@/stores/hierarchyStore'
import { CountdownChip } from './CountdownChip'
import type { GoogleEventView } from './types'

export function DeedTable({
  allTasks,
  googleEvents,
  showGoogle,
  countdownNow,
  onOpen,
  onToggle,
  onDelete,
  onWeightChange,
}: {
  allTasks: Task[]
  googleEvents: GoogleEventView[]
  showGoogle: boolean
  countdownNow: Date
  onOpen: (task: Task) => void
  onToggle: (task: Task) => void
  onDelete: (e: React.MouseEvent, taskId: string) => void
  onWeightChange: (task: Task, weight: number) => void
}) {
  return (
            <div className="glass rounded-[8px] overflow-hidden border border-white/10 animate-fadeIn">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
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
                  {[...allTasks].sort((a, b) => {
                    if (!a.startTime) return 1
                    if (!b.startTime) return -1
                    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
                  }).map(t => {
                    return (
                      <tr key={t.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors cursor-pointer group" onClick={() => onOpen(t)}>
                        <td className="p-3 font-mono text-xs text-ink/50">
                          <div className="flex items-center gap-1.5">
                            <span>
                              {t.startTime ? format(new Date(t.startTime), 'h:mm a') : '—'}
                              {t.endTime ? `–${format(new Date(t.endTime), 'h:mm a')}` : ''}
                            </span>
                            <CountdownChip task={t} now={countdownNow} />
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center space-x-2 min-w-[160px]">
                            <button onClick={(e) => { e.stopPropagation(); onToggle(t) }} className="shrink-0">
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
                                onChange={e => onWeightChange(t, parseFloat(e.target.value) || 1)}
                                className="w-10 px-1 py-0.5 text-[10px] bg-mist/30 rounded border border-transparent hover:border-mist focus:bg-paper focus:border-gold outline-none font-mono"
                              />
                              <span className="text-[10px] text-ink/40 ml-0.5">%</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); onToggle(t) }}
                            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all"
                            title={t.completed ? 'Mark pending' : 'Mark done'}
                          >
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${t.completed ? 'bg-sage/20 text-sage border border-sage/30' : 'bg-gold/20 text-gold border border-gold/30'}`}
                            >
                              {t.completed ? 'Done' : 'Pending'}
                            </span>
                          </button>
                        </td>
                        <td className="p-3 text-xs text-ink/40 max-w-[200px] truncate">{t.reflection || '—'}</td>
                        <td className="p-3">
                          <button
                            onClick={(e) => onDelete(e, t.id)}
                            className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-ember/15 rounded-lg transition text-ink/30 hover:text-[#cf8f78]"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {showGoogle && googleEvents.map(g => (
                    <tr key={g.id} className="border-b border-white/5 last:border-0">
                      <td className="p-3 font-mono text-xs text-gold/50">
                        {format(new Date(g.startTime), 'h:mm a')}{g.endTime ? `–${format(new Date(g.endTime), 'h:mm a')}` : ''}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-gold/80">{g.title}</span>
                        </div>
                      </td>
                      <td className="p-3 text-xs text-ink/30">—</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gold/10 text-gold/80">Google</span>
                      </td>
                      <td className="p-3 text-xs text-ink/30">—</td>
                      <td className="p-3"></td>
                    </tr>
                  ))}
                  {allTasks.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-ink/40">No deeds scheduled for today.</td></tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
  )
}
