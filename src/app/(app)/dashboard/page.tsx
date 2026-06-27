'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useHierarchyStore } from '@/store/hierarchyStore'
import { Activity, Target, Flame, Calendar, CheckCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const router = useRouter()
  const { items, completionMap, setItems, setUserCategories } = useHierarchyStore()
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)

  useEffect(() => {
    fetch('/api/items')
      .then(res => res.json())
      .then(data => {
        if (data.items) {
          // Reconstruct tree
          const itemMap = new Map()
          data.items.forEach((item: any) => itemMap.set(item.id, { ...item, children: [] }))
          const tree: any[] = []
          
          data.items.forEach((item: any) => {
            if (item.parentId) {
              const parent = itemMap.get(item.parentId)
              if (parent) parent.children.push(itemMap.get(item.id))
            } else {
              tree.push(itemMap.get(item.id))
            }
          })
          
          setItems(tree)
        }
        if (data.categories) setUserCategories(data.categories)
      })
      .finally(() => setLoading(false))
  }, [setItems, setUserCategories])

  const handleSeed = async () => {
    setSeeding(true)
    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      if (res.ok) {
        window.location.reload() // Reload to fetch new data
      }
    } finally {
      setSeeding(false)
    }
  }

  if (loading) return <div className="flex justify-center items-center h-full">Loading...</div>

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-6">
        <h1 className="text-3xl font-display font-bold text-gold">Welcome to Inchstone</h1>
        <p className="text-ink/70 max-w-md text-center">Your daily deeds flow from your yearly vision. Seed the 2026 framework to get started on your journey.</p>
        <button 
          onClick={handleSeed}
          disabled={seeding}
          className="px-6 py-3 bg-gold text-surface font-semibold rounded-lg shadow-sm hover:bg-gold/90 transition disabled:opacity-50"
        >
          {seeding ? 'Seeding...' : 'Seed 2026 Framework'}
        </button>
      </div>
    )
  }

  // Calculate stats
  const whyItem = items.find(i => i.layer === 1)
  const totalCompletion = whyItem ? completionMap[whyItem.id] || 0 : 0
  
  // Find today's deeds (layer 5 where startDate is today)
  // For demo purposes, we'll just grab the first 5 incomplete deeds from layer 5
  const allDeeds: any[] = []
  const collectDeeds = (nodes: any[]) => {
    nodes.forEach(n => {
      if (n.layer === 5) allDeeds.push(n)
      if (n.children) collectDeeds(n.children)
    })
  }
  collectDeeds(items)
  
  const pendingDeeds = allDeeds.filter(d => !d.completed).slice(0, 5)

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-display font-bold text-ink">Dashboard</h1>
      
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="flex items-center space-x-4">
          <div className="p-3 bg-sage/20 rounded-full text-sage">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-ink/70">Completion</p>
            <p className="text-xl font-bold">{Math.round(totalCompletion)}%</p>
          </div>
        </Card>
        <Card className="flex items-center space-x-4">
          <div className="p-3 bg-coral/20 rounded-full text-coral">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-ink/70">Current Streak</p>
            <p className="text-xl font-bold">4 Days</p>
          </div>
        </Card>
        <Card className="flex items-center space-x-4">
          <div className="p-3 bg-gold/20 rounded-full text-gold">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-ink/70">Active Quests</p>
            <p className="text-xl font-bold">1</p>
          </div>
        </Card>
        <Card className="flex items-center space-x-4">
          <div className="p-3 bg-ink/10 rounded-full text-ink">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-ink/70">Due This Week</p>
            <p className="text-xl font-bold">12</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hierarchy Progress */}
        <div className="col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-ink">Goal Hierarchy</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             {/* Render some hierarchy progress cards */}
             {whyItem && (
               <Card className="flex justify-between items-center cursor-pointer hover:bg-mist/30 transition-colors"
                     onClick={() => router.push('/year')}>
                 <div>
                   <p className="text-xs font-mono text-gold mb-1">LAYER 1: WHY</p>
                   <p className="font-bold">{whyItem.title}</p>
                 </div>
                 <ProgressRing progress={completionMap[whyItem.id] || 0} size={50} />
               </Card>
             )}
          </div>
        </div>

        {/* Today's Deeds */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-ink">Today's Deeds</h2>
          <Card className="p-0 overflow-hidden">
            <div className="divide-y divide-mist">
              {pendingDeeds.length === 0 ? (
                <div className="p-4 text-center text-ink/60 text-sm">No pending deeds!</div>
              ) : (
                pendingDeeds.map(deed => (
                  <div key={deed.id} className="p-4 flex items-center justify-between hover:bg-mist/20">
                    <div className="flex items-center space-x-3">
                      <div className="w-4 h-4 rounded-sm border border-ink/30" />
                      <span className="text-sm font-medium">{deed.title}</span>
                    </div>
                    {deed.category && (
                      <span className="text-[10px] uppercase font-mono px-2 py-1 bg-mist rounded-full text-ink/70">
                        {deed.category}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="p-3 bg-surface border-t border-mist text-center">
              <button 
                onClick={() => router.push('/year')}
                className="text-xs text-gold font-semibold hover:underline"
              >
                View all in Year View &rarr;
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
