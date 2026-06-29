'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useHierarchyStore } from '@/store/hierarchyStore'
import { Activity, Target, Flame, BarChart3, CheckCircle, ListTodo } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'

export default function DashboardPage() {
  const router = useRouter()
  const { items, completionMap, setItems, setUserCategories } = useHierarchyStore()
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [dailyScore, setDailyScore] = useState<{ totalTasks: number, completedTasks: number, score: number } | null>(null)

  useEffect(() => {
    const today = new Date().toISOString()
    fetch(`/api/daily-score?date=${today}`)
      .then(r => r.json())
      .then(data => {
        if (data.dailyScore) setDailyScore(data.dailyScore)
      })
      .catch(() => { })
  }, [])

  useEffect(() => {
    fetch('/api/items')
      .then(res => res.json())
      .then(data => {
        if (data.items) {
          const itemMap = new Map()
          data.items.forEach((item: any) => itemMap.set(item.id, { ...item, children: [], tasks: item.tasks || [] }))
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
        window.location.reload()
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
        <p className="text-ink/70 max-w-md text-center">Your daily deeds flow from your yearly vision. Seed the framework to get started on your journey.</p>
        <button
          onClick={handleSeed}
          disabled={seeding}
          className="px-6 py-3 bg-gold text-surface font-semibold rounded-lg shadow-sm hover:bg-gold/90 transition disabled:opacity-50"
        >
          {seeding ? 'Seeding...' : 'Seed Framework'}
        </button>
      </div>
    )
  }

  // Calculate cascading stats
  const whyItem = items.find(i => i.layer === 1)
  const totalCompletion = whyItem ? completionMap[whyItem.id] || 0 : 0

  const countByLayer = (layer: number) => items.filter(i => i.layer === layer).length
  const completeByLayer = (layer: number) => items.filter(i => i.layer === layer && (completionMap[i.id] || 0) >= 100).length

  const getChildren = (parentId: string) => {
    const result: any[] = []
    const collect = (nodes: any[]) => {
      nodes.forEach(n => {
        if (n.parentId === parentId) result.push(n)
        if (n.children) collect(n.children)
      })
    }
    collect(items)
    return result
  }

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
            <p className="text-sm text-ink/70">Yearly Vision</p>
            <p className="text-xl font-bold">{Math.round(totalCompletion)}%</p>
          </div>
        </Card>
        <Card className="flex items-center space-x-4">
          <div className="p-3 bg-coral/20 rounded-full text-coral">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-ink/70">Quarters</p>
            <p className="text-xl font-bold">{completeByLayer(2)}/{countByLayer(2)}</p>
          </div>
        </Card>
        <Card className="flex items-center space-x-4">
          <div className="p-3 bg-gold/20 rounded-full text-gold">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-ink/70">Monthly Goals</p>
            <p className="text-xl font-bold">{completeByLayer(3)}/{countByLayer(3)}</p>
          </div>
        </Card>
        <Card className="flex items-center space-x-4">
          <div className="p-3 bg-sage/20 rounded-full text-sage">
            <ListTodo className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-ink/70">Today's Progress</p>
            <p className="text-xl font-bold">
              {dailyScore ? `${dailyScore.score}%` : '—'}
            </p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hierarchy Progress */}
        <div className="col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-ink">Goal Hierarchy</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {whyItem && (
              <Card className="flex justify-between items-center cursor-pointer hover:bg-mist/30 transition-colors"
                onClick={() => router.push('/year')}>
                <div>
                  <p className="text-xs font-mono text-gold mb-1">LAYER 1: YEARLY VISION</p>
                  <p className="font-bold">{whyItem.title}</p>
                  <p className="text-xs text-ink/50 mt-1">
                    {completeByLayer(5)}/{countByLayer(5)} deeds done
                  </p>
                </div>
                <ProgressRing progress={totalCompletion} size={50} />
              </Card>
            )}
            {/* Quarterly cards */}
            {items.filter(i => i.layer === 2).slice(0, 4).map(q => (
              <Card key={q.id} className="flex justify-between items-center cursor-pointer hover:bg-mist/30 transition-colors"
                onClick={() => router.push('/year')}>
                <div>
                  <p className="text-xs font-mono text-coral mb-1">QUARTER {q.title}</p>
                  <p className="font-bold">{q.title}</p>
                </div>
                <ProgressRing progress={completionMap[q.id] || 0} size={40} />
              </Card>
            ))}
          </div>

          {/* Monthly breakdown */}
          <h2 className="text-lg font-bold text-ink mt-6">Monthly Milestones</h2>
          <div className="space-y-3">
            {items.filter(i => i.layer === 3).slice(0, 6).map(ms => (
              <Card key={ms.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1">
                  <div className={`w-3 h-3 rounded-full ${(completionMap[ms.id] || 0) >= 100 ? 'bg-sage' : 'bg-gold'}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink">{ms.title}</p>
                    <p className="text-xs text-ink/50">
                      {ms.startDate && format(new Date(ms.startDate), 'MMM d')} — {ms.endDate && format(new Date(ms.endDate), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-24 h-2 bg-mist rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${(completionMap[ms.id] || 0) >= 100 ? 'bg-sage' : 'bg-gold'}`}
                      style={{ width: `${completionMap[ms.id] || 0}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-ink/50 w-8 text-right">
                    {Math.round(completionMap[ms.id] || 0)}%
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Today's Tasks */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-ink">Today's Overview</h2>
          <Card className="p-0 overflow-hidden">
            <div className="divide-y divide-mist">
              {/* Daily deeds for today */}
              {items.filter(i => i.layer === 5 && i.startDate && format(new Date(i.startDate), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).slice(0, 5).map(deed => {
                const pct = completionMap[deed.id] || 0
                const tasks = deed.tasks || []
                const doneTasks = tasks.filter(t => t.completed).length
                return (
                  <div key={deed.id} className="p-4 hover:bg-mist/20 cursor-pointer"
                    onClick={() => router.push('/calendar')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-4 h-4 rounded-sm border-2 ${pct >= 100 ? 'bg-sage border-sage' : 'border-gold'}`}>
                          {pct >= 100 && <CheckCircle className="w-4 h-4 text-white" />}
                        </div>
                        <span className={`text-sm font-medium ${pct >= 100 ? 'line-through text-ink/50' : 'text-ink'}`}>
                          {deed.title}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-ink/50">{Math.round(pct)}%</span>
                    </div>
                    {tasks.length > 0 && (
                      <div className="mt-1.5 pl-7">
                        <div className="flex items-center space-x-1">
                          <div className="w-full h-1.5 bg-mist rounded-full overflow-hidden">
                            <div className="h-full bg-sage rounded-full" style={{ width: `${(doneTasks / tasks.length) * 100}%` }} />
                          </div>
                          <span className="text-[10px] text-ink/40">{doneTasks}/{tasks.length}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              {items.filter(i => i.layer === 5 && i.startDate && format(new Date(i.startDate), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).length === 0 && (
                <div className="p-4 text-center text-ink/60 text-sm">No deeds for today</div>
              )}
            </div>
            <div className="p-3 bg-surface border-t border-mist text-center">
              <button
                onClick={() => router.push('/calendar')}
                className="text-xs text-gold font-semibold hover:underline"
              >
                View full calendar &rarr;
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}