'use client'

import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import type { Item } from '@/stores/hierarchyStore'

/** Today's Goals and "Contributes To" cards for the day's primary goal. */
export function GoalCards({
  primaryGoal,
  dailyGoals,
  completionMap,
  findItem,
}: {
  primaryGoal: Item | undefined
  dailyGoals: Item[]
  completionMap: Record<string, number>
  findItem: (id: string) => Item | undefined
}) {
  return (
    <>
<Card className="p-4 sm:p-6 space-y-4">
              <p className="text-xs font-bold uppercase text-ink/50">Today&apos;s Goals</p>
              {(() => {
                // Only show the primary daily goal (the one that actually has tasks, or the first one)
                const activeGoal = primaryGoal || dailyGoals[0]
                if (!activeGoal) return <p className="text-xs text-ink/40">No daily goals for this date.</p>
                return (
                  <div key={activeGoal.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-ink truncate">{activeGoal.title}</span>
                      <span className="font-mono text-xs text-ink/50">{Math.round(completionMap[activeGoal.id] || 0)}%</span>
                    </div>
                    <ProgressBar progress={completionMap[activeGoal.id] || 0} colorClass="bg-sage" />
                  </div>
                )
              })()}
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
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          ancestor.layer === 0 ? 'bg-gold-dim/20 text-gold-dim' :
                            ancestor.layer === 1 ? 'bg-gold/15 text-gold' :
                              ancestor.layer === 2 ? 'bg-moss/15 text-[#7fa871]' :
                                ancestor.layer === 3 ? 'bg-ember/15 text-[#cf8f78]' :
                                  ancestor.layer === 4 ? 'bg-parchment/10 text-parchment/70' :
                                    'bg-mist/30 text-parchment/60'
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
    </>
  )
}
