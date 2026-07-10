'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useHierarchyStore } from '@/stores/hierarchyStore'
import { Activity, Target, Flame, BarChart3, CheckCircle, ListTodo, MessageSquare, X, TrendingUp, Award } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'

interface Nudge {
  id: string
  message: string
  partner: { name: string }
  createdAt: string
}

export default function DashboardPage() {
  const router = useRouter()
  const { items, completionMap, setItems, getFlatItems } = useHierarchyStore()
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [dailyScore, setDailyScore] = useState<{ totalTasks: number, completedTasks: number, score: number } | null>(null)
  const [nudges, setNudges] = useState<Nudge[]>([])
  const [touchStart, setTouchStart] = useState<number | null>(null)

  useEffect(() => {
    const today = new Date().toISOString()
    fetch(`/api/daily-score?date=${today}`)
      .then(r => r.json())
      .then(data => {
        if (data.dailyScore) setDailyScore(data.dailyScore)
      })
      .catch(() => { })

    fetch('/api/nudges')
      .then(r => r.json())
      .then(data => {
        if (data.nudges) setNudges(data.nudges)
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
      })
      .finally(() => setLoading(false))
  }, [setItems])

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
      <div className="flex flex-col items-center justify-center h-full space-y-6 p-6">
        <div className="w-24 h-24 rounded-full bg-gold/10 flex items-center justify-center animate-pulseGlow">
          <Award className="w-12 h-12 text-gold" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-display font-bold bg-gradient-to-r from-gold to-gold-glow bg-clip-text text-transparent text-center">Welcome to Inchstone</h1>
        <p className="text-ink/70 max-w-md text-center text-sm sm:text-base">Your daily deeds flow from your yearly vision. Seed the framework to get started on your journey.</p>
        <button
          onClick={handleSeed}
          disabled={seeding}
          className="px-8 py-4 bg-gold text-surface font-bold rounded-xl hover:bg-gold-glow active:scale-95 transition-all shadow-lg shadow-gold/20 min-h-[48px] text-sm sm:text-base"
        >
          {seeding ? 'Seeding...' : 'Seed Framework'}
        </button>
      </div>
    )
  }

  const flatItems = getFlatItems()
  const whyItem = flatItems.find(i => i.layer === 1)
  const totalCompletion = whyItem ? completionMap[whyItem.id] || 0 : 0

  const countByLayer = (layer: number) => flatItems.filter(i => i.layer === layer).length
  const completeByLayer = (layer: number) => flatItems.filter(i => i.layer === layer && (completionMap[i.id] || 0) >= 100).length

  const getChildren = (parentId: string) => {
    return flatItems.filter(n => n.parentId === parentId)
  }

  const stats = [
    { label: 'Yearly Vision', value: `${Math.round(totalCompletion)}%`, icon: Activity, color: 'sage', bg: 'bg-sage/20' },
    { label: 'Quarters', value: `${completeByLayer(2)}/${countByLayer(2)}`, icon: BarChart3, color: 'coral', bg: 'bg-coral/20' },
    { label: 'Monthly Goals', value: `${completeByLayer(3)}/${countByLayer(3)}`, icon: Target, color: 'gold', bg: 'bg-gold/20' },
    { label: 'Today', value: dailyScore ? `${dailyScore.score}%` : '—', icon: ListTodo, color: 'sage', bg: 'bg-sage/20' },
  ]

  return (
    <div className="space-y-4 sm:space-y-6 max-w-6xl mx-auto pb-24 lg:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-ink">Dashboard</h1>
          <p className="text-xs sm:text-sm text-ink/50 mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <button onClick={() => router.push('/partners')} className="text-xs sm:text-sm font-semibold text-sage hover:text-sage/80 active:scale-95 transition px-3 py-2 rounded-lg hover:bg-sage/10 min-h-[36px]">
          Manage Partners
        </button>
      </div>

      {/* Incoming Nudges */}
      {nudges.length > 0 && (
        <div className="space-y-2">
          {nudges.map(nudge => (
            <div key={nudge.id} className="bg-sage/10 border border-sage/30 rounded-xl p-4 flex items-start justify-between active:scale-[0.99] transition-transform">
              <div className="flex items-start space-x-3 flex-1 min-w-0">
                <div className="p-2 bg-sage/20 rounded-full text-sage shrink-0 mt-0.5">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink mb-1">
                    Nudge from {nudge.partner?.name || 'a partner'}
                  </p>
                  <p className="text-sm text-ink/70 line-clamp-2">"{nudge.message}"</p>
                  <p className="text-[10px] text-ink/40 mt-1 font-mono">
                    {format(new Date(nudge.createdAt), 'MMM d, h:mm a')}
                  </p>
                </div>
              </div>
              <button
                onClick={async () => {
                  try {
                    await fetch('/api/nudges', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ nudgeId: nudge.id, read: true })
                    })
                    setNudges(prev => prev.filter(n => n.id !== nudge.id))
                  } catch (e) {
                    console.error(e)
                  }
                }}
                className="p-2 text-ink/30 hover:text-ink hover:bg-mist rounded-lg active:scale-90 transition min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0"
                title="Mark as read"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Top Stats - Mobile optimized */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon
          return (
            <Card key={idx} className="p-4 sm:p-5 active:scale-95 transition-transform">
              <div className="flex items-center space-x-3">
                <div className={`p-2.5 sm:p-3 rounded-xl ${stat.bg} text-${stat.color} shrink-0`}>
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-ink/50 font-medium uppercase tracking-wider truncate">{stat.label}</p>
                  <p className="text-lg sm:text-xl font-bold text-ink font-mono">{stat.value}</p>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Hierarchy Progress */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg sm:text-xl font-bold text-ink">Goal Hierarchy</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {whyItem && (
              <Card
                className="flex justify-between items-center cursor-pointer hover:border-gold active:scale-95 transition-all"
                onClick={() => router.push('/year')}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] sm:text-xs font-mono text-gold mb-1 uppercase tracking-wider">LAYER 1: YEARLY VISION</p>
                  <p className="font-bold text-sm sm:text-base truncate">{whyItem.title}</p>
                  <p className="text-[10px] sm:text-xs text-ink/50 mt-1">
                    {completeByLayer(5)}/{countByLayer(5)} deeds done
                  </p>
                </div>
                <ProgressRing progress={totalCompletion} size={40} className="sm:hidden" />
                <ProgressRing progress={totalCompletion} size={50} className="hidden sm:block" />
              </Card>
            )}
            {flatItems.filter(i => i.layer === 2).slice(0, 4).map(q => (
              <Card
                key={q.id}
                className="flex justify-between items-center cursor-pointer hover:border-gold active:scale-95 transition-all"
                onClick={() => router.push('/year')}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] sm:text-xs font-mono text-coral mb-1 uppercase tracking-wider">QUARTER {q.title}</p>
                  <p className="font-bold text-sm sm:text-base truncate">{q.title}</p>
                </div>
                <ProgressRing progress={completionMap[q.id] || 0} size={36} className="sm:hidden" />
                <ProgressRing progress={completionMap[q.id] || 0} size={40} className="hidden sm:block" />
              </Card>
            ))}
          </div>

          {/* Monthly breakdown */}
          <h2 className="text-lg sm:text-xl font-bold text-ink mt-6">Monthly Milestones</h2>
          <div className="space-y-2 sm:space-y-3">
            {flatItems.filter(i => i.layer === 3).slice(0, 6).map(ms => (
              <Card key={ms.id} className="flex items-center justify-between p-3 sm:p-4 active:scale-[0.98] transition-transform">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0 ${(completionMap[ms.id] || 0) >= 100 ? 'bg-sage' : 'bg-gold'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{ms.title}</p>
                    <p className="text-[10px] sm:text-xs text-ink/50">
                      {ms.startDate && format(new Date(ms.startDate), 'MMM d')} — {ms.endDate && format(new Date(ms.endDate), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 sm:space-x-4 shrink-0">
                  <div className="w-16 sm:w-24 h-1.5 sm:h-2 bg-mist rounded-full overflow-hidden">
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
          <h2 className="text-lg sm:text-xl font-bold text-ink">Today's Overview</h2>
          <Card className="p-0 overflow-hidden">
            <div className="divide-y divide-mist">
              {flatItems.filter(i => i.layer === 5 && i.startDate && format(new Date(i.startDate), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).slice(0, 5).map(deed => {
                const pct = completionMap[deed.id] || 0
                const tasks = deed.tasks || []
                const doneTasks = tasks.filter(t => t.completed).length
                return (
                  <div
                    key={deed.id}
                    className="p-3 sm:p-4 hover:bg-mist/20 active:bg-mist/30 cursor-pointer transition-all"
                    onClick={() => router.push('/calendar')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                        <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 shrink-0 ${pct >= 100 ? 'bg-sage border-sage' : 'border-gold'}`}>
                          {pct >= 100 && <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />}
                        </div>
                        <span className={`text-xs sm:text-sm font-medium truncate ${pct >= 100 ? 'line-through text-ink/50' : 'text-ink'}`}>
                          {deed.title}
                        </span>
                      </div>
                      <span className="text-[10px] sm:text-xs font-mono text-ink/50 ml-2 shrink-0">{Math.round(pct)}%</span>
                    </div>
                    {tasks.length > 0 && (
                      <div className="mt-2 ml-6 sm:ml-7">
                        <div className="flex items-center space-x-2">
                          <div className="flex-1 h-1 sm:h-1.5 bg-mist rounded-full overflow-hidden">
                            <div className="h-full bg-sage rounded-full transition-all" style={{ width: `${(doneTasks / tasks.length) * 100}%` }} />
                          </div>
                          <span className="text-[9px] sm:text-[10px] text-ink/40">{doneTasks}/{tasks.length}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              {flatItems.filter(i => i.layer === 5 && i.startDate && format(new Date(i.startDate), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).length === 0 && (
                <div className="p-4 sm:p-6 text-center text-ink/60 text-xs sm:text-sm">No deeds for today</div>
              )}
            </div>
            <div className="p-3 bg-surface border-t border-mist text-center">
              <button
                onClick={() => router.push('/calendar')}
                className="text-xs sm:text-sm text-gold font-semibold hover:underline active:scale-95 transition"
              >
                View full calendar →
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}