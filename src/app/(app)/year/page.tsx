'use client'

import { useHierarchyStore, Item } from '@/store/hierarchyStore'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'

export default function YearPage() {
  const router = useRouter()
  const { items, completionMap } = useHierarchyStore()

  const yearItem = items.find(i => i.layer === 1)

  if (!yearItem) {
    return <div className="p-6">Please seed the framework from the Dashboard first.</div>
  }

  const quarters = items.filter(i => i.layer === 2)
  const allMonths = items.filter(i => i.layer === 3)
  const allWeeks = items.filter(i => i.layer === 4)
  const allDeeds = items.filter(i => i.layer === 5)

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Year Vision Banner */}
      <div className="bg-surface border-y border-mist p-8 text-center -mx-6 mb-8">
        <h1 className="text-3xl font-display font-bold text-ink mb-2">{yearItem.title}</h1>
        <p className="text-lg text-gold font-serif italic mb-4">"{yearItem.anchorScripture}"</p>
        <p className="text-sm font-mono text-ink/70 max-w-xl mx-auto">{yearItem.description}</p>
        <p className="mt-4 text-xs font-bold uppercase tracking-widest text-sage">Focus: {yearItem.focusQuestion}</p>
        <div className="max-w-md mx-auto mt-6">
          <ProgressBar progress={completionMap[yearItem.id] || 0} showLabel />
        </div>
      </div>

      {/* Quarters Section */}
      <div className="space-y-8">
        {quarters.map(quarter => {
          const months = allMonths.filter(m => m.parentId === quarter.id)
          return (
            <div key={quarter.id} className="space-y-6">
              <div className="flex items-center justify-between border-b border-mist pb-2">
                <div>
                  <h2 className="text-2xl font-display font-bold text-ink">{quarter.title}</h2>
                  {quarter.startDate && (
                    <p className="text-xs text-ink/50">
                      {format(new Date(quarter.startDate), 'MMM d')} — {quarter.endDate && format(new Date(quarter.endDate), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>
                <ProgressRing progress={completionMap[quarter.id] || 0} size={48} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {months.map(month => {
                  const weeks = allWeeks.filter(w => w.parentId === month.id)
                  return (
                    <Card key={month.id} className="space-y-4">
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <h3 className="font-bold">{month.title}</h3>
                          {month.startDate && (
                            <p className="text-[10px] text-ink/50">
                              {format(new Date(month.startDate), 'MMM d')} — {month.endDate && format(new Date(month.endDate), 'MMM d')}
                            </p>
                          )}
                        </div>
                        <span className="text-xs font-mono">{Math.round(completionMap[month.id] || 0)}%</span>
                      </div>
                      <ProgressBar progress={completionMap[month.id] || 0} colorClass="bg-sage" />

                      {/* Weeks nested inside */}
                      <div className="space-y-3 mt-4">
                        {weeks.map(week => {
                          const deeds = allDeeds.filter(d => d.parentId === week.id)
                          return (
                            <div key={week.id} className="border border-mist rounded-lg p-3 bg-paper">
                              <div className="flex justify-between items-center mb-2">
                                <h4 className="text-xs font-bold text-ink/70 uppercase">{week.title}</h4>
                                <ProgressRing progress={completionMap[week.id] || 0} size={28} strokeWidth={3} />
                              </div>

                              {/* 7-Day grid for deeds */}
                              <div className="grid grid-cols-7 gap-1">
                                {deeds.map(deed => {
                                  const pct = completionMap[deed.id] || 0
                                  const tasks = deed.tasks || []
                                  return (
                                    <button
                                      key={deed.id}
                                      onClick={() => router.push('/calendar')}
                                      className={`aspect-square rounded-md flex flex-col items-center justify-center border transition-all ${pct >= 100
                                          ? 'bg-sage text-surface border-sage'
                                          : pct > 0
                                            ? 'bg-gold/20 text-ink border-gold/40'
                                            : 'bg-surface border-mist hover:border-gold'
                                        }`}
                                      title={`${deed.title} (${Math.round(pct)}%)`}
                                    >
                                      <span className="text-[9px] font-mono">
                                        {deed.startDate ? format(new Date(deed.startDate), 'd') : '?'}
                                      </span>
                                      {tasks.length > 0 && (
                                        <span className="text-[7px] opacity-60">
                                          {tasks.filter(t => t.completed).length}/{tasks.length}
                                        </span>
                                      )}
                                    </button>
                                  )
                                })}
                                {deeds.length === 0 && (
                                  <div className="col-span-7 text-[10px] text-ink/30 text-center py-2">
                                    No deeds
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                        {weeks.length === 0 && (
                          <p className="text-xs text-ink/40 text-center py-2">No weekly goals defined</p>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary stats */}
      <div className="border-t border-mist pt-6 mt-8">
        <div className="grid grid-cols-5 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gold">{quarters.length}</div>
            <div className="text-xs text-ink/50">Quarters</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gold">{allMonths.length}</div>
            <div className="text-xs text-ink/50">Months</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gold">{allWeeks.length}</div>
            <div className="text-xs text-ink/50">Weeks</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gold">{allDeeds.length}</div>
            <div className="text-xs text-ink/50">Deeds</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gold">
              {allDeeds.filter(d => (completionMap[d.id] || 0) >= 100).length}
            </div>
            <div className="text-xs text-ink/50">Done</div>
          </div>
        </div>
      </div>
    </div>
  )
}