'use client'

import { useHierarchyStore, Item } from '@/store/hierarchyStore'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useState } from 'react'
import { DayModal } from '@/components/items/DayModal'

export default function YearPage() {
  const { items, completionMap, completedMap, toggleDeed } = useHierarchyStore()
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)

  const whyItem = items.find(i => i.layer === 1)

  if (!whyItem) {
    return <div className="p-6">Please seed the framework from the Dashboard first.</div>
  }

  // Group quests
  const quests = whyItem.children || []

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="bg-surface border-y border-mist p-8 text-center -mx-6 mb-8">
        <h1 className="text-3xl font-display font-bold text-ink mb-2">{whyItem.title}</h1>
        <p className="text-lg text-gold font-serif italic mb-4">"{whyItem.anchorScripture}"</p>
        <p className="text-sm font-mono text-ink/70 max-w-xl mx-auto">{whyItem.description}</p>
        <p className="mt-4 text-xs font-bold uppercase tracking-widest text-sage">Activation: {whyItem.focusQuestion}</p>
        <div className="max-w-md mx-auto mt-6">
          <ProgressBar progress={completionMap[whyItem.id] || 0} showLabel />
        </div>
      </div>

      {/* Quests View */}
      <div className="space-y-12">
        {quests.map(quest => (
          <div key={quest.id} className="space-y-6">
            <div className="flex items-center justify-between border-b border-mist pb-2">
              <h2 className="text-2xl font-display font-bold text-ink">{quest.title}</h2>
              <ProgressRing progress={completionMap[quest.id] || 0} size={48} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(quest.children || []).map(milestone => (
                <Card key={milestone.id} className="space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold">{milestone.title}</h3>
                    <span className="text-xs font-mono">{Math.round(completionMap[milestone.id] || 0)}%</span>
                  </div>
                  <ProgressBar progress={completionMap[milestone.id] || 0} colorClass="bg-sage" />
                  
                  <div className="space-y-4 mt-6">
                    {(milestone.children || []).map(win => (
                      <div key={win.id} className="border border-mist rounded-lg p-3 bg-paper">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="text-xs font-bold text-ink/70 uppercase">{win.title}</h4>
                          <ProgressRing progress={completionMap[win.id] || 0} size={32} strokeWidth={3} />
                        </div>
                        
                        {/* 7-Day Grid */}
                        <div className="grid grid-cols-7 gap-1">
                          {(win.children || []).map(deed => (
                            <button
                              key={deed.id}
                              onClick={() => setSelectedDayId(deed.id)}
                              className={`aspect-square rounded-md flex items-center justify-center border transition-all ${
                                completedMap[deed.id]
                                  ? 'bg-sage text-surface border-sage'
                                  : 'bg-surface border-mist hover:border-gold'
                              }`}
                              title={deed.title}
                            >
                              <span className="text-[10px] font-mono">
                                {new Date(deed.startDate!).getDate()}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedDayId && (
        <DayModal 
          deedId={selectedDayId} 
          onClose={() => setSelectedDayId(null)} 
        />
      )}
    </div>
  )
}
