'use client'

import { useEffect, useState, useMemo } from 'react'
import { useHierarchyStore } from '@/stores/hierarchyStore'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  Target, Flame, BarChart3, CheckCircle, ListTodo, MessageSquare,
  X, TrendingUp, Award, Users, ArrowRight, Sparkles, Sun, Zap,
  CalendarDays, DollarSign, Star, Trophy, Shield, Zap as Bolt,
  Gem, Sword, Crown, Rocket, Heart, BookOpen, Coffee, Moon
} from 'lucide-react'

interface Nudge {
  id: string
  message: string
  partner: { name: string }
  createdAt: string
}

// ── Gamification Constants ──
const XP_PER_TASK = 10
const XP_PER_DEED = 25
const XP_PER_GOAL = 50
const XP_LEVEL_MULTIPLIER = 1.5

const LEVEL_TITLES = [
  'Novice', 'Apprentice', 'Journeyman', 'Artisan', 'Adept',
  'Expert', 'Master', 'Grandmaster', 'Sage', 'Legend'
]

const ACHIEVEMENTS = [
  { id: 'first_deed', icon: Star, label: 'First Steps', desc: 'Complete your first daily deed', check: (s: any) => s.totalDeeds >= 1 },
  { id: 'week_streak', icon: Flame, label: 'On Fire', desc: '7-day streak', check: (s: any) => s.streak >= 7 },
  { id: 'month_streak', icon: Trophy, label: 'Unstoppable', desc: '30-day streak', check: (s: any) => s.streak >= 30 },
  { id: 'ten_deeds', icon: Shield, label: 'Dedicated', desc: 'Complete 10 deeds', check: (s: any) => s.totalDeeds >= 10 },
  { id: 'fifty_deeds', icon: Sword, label: 'Warrior', desc: 'Complete 50 deeds', check: (s: any) => s.totalDeeds >= 50 },
  { id: 'hundred_deeds', icon: Crown, label: 'Champion', desc: 'Complete 100 deeds', check: (s: any) => s.totalDeeds >= 100 },
  { id: 'level_5', icon: Gem, label: 'Shining Bright', desc: 'Reach level 5', check: (s: any) => s.level >= 5 },
  { id: 'level_10', icon: Rocket, label: 'Skyrocket', desc: 'Reach level 10', check: (s: any) => s.level >= 10 },
  { id: 'all_sections', icon: Heart, label: 'Balanced Life', desc: 'Have goals in all 4 sections', check: (s: any) => s.sectionsCovered >= 4 },
  { id: 'perfect_day', icon: Sun, label: 'Perfect Day', desc: 'Complete all today\'s deeds', check: (s: any) => s.perfectDays >= 1 },
]

const MOTIVATIONAL_QUOTES = [
  '"Small steps lead to big changes."',
  '"Every inch counts on the mile-long journey."',
  '"Consistency over intensity."',
  '"Your future is built by what you do today."',
  '"Progress, not perfection."',
  '"The secret of getting ahead is getting started."',
  '"Inch by inch, anything\'s a cinch."',
]

export default function DashboardPage() {
  const router = useRouter()
  const { items, completionMap, setItems, getFlatItems } = useHierarchyStore()
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [dailyScore, setDailyScore] = useState<{ totalTasks: number, completedTasks: number, score: number } | null>(null)
  const [nudges, setNudges] = useState<Nudge[]>([])
  const [greeting, setGreeting] = useState('')
  const [greetingIcon, setGreetingIcon] = useState<React.ReactNode>(null)
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [quote] = useState(() => MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)])

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) { setGreeting('Good morning'); setGreetingIcon(<Sun className="w-5 h-5 text-gold" />) }
    else if (hour < 17) { setGreeting('Good afternoon'); setGreetingIcon(<Sun className="w-5 h-5 text-gold" />) }
    else { setGreeting('Good evening'); setGreetingIcon(<Moon className="w-5 h-5 text-gold" />) }
  }, [])

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

  const flatItems = getFlatItems()
  const whyItem = flatItems.find(i => i.layer === 1)
  const totalCompletion = whyItem ? completionMap[whyItem.id] || 0 : 0

  const countByLayer = (layer: number) => flatItems.filter(i => i.layer === layer).length
  const completeByLayer = (layer: number) => flatItems.filter(i => i.layer === layer && (completionMap[i.id] || 0) >= 100).length

  // ── Gamification Calculations ──
  const gamification = useMemo(() => {
    const deeds = flatItems.filter(i => i.layer === 5)
    const totalDeeds = deeds.length
    const completedDeeds = deeds.filter(i => (completionMap[i.id] || 0) >= 100).length
    const totalTasks = flatItems.reduce((sum, i) => sum + (i.tasks?.length || 0), 0)
    const completedTasks = flatItems.reduce((sum, i) => sum + (i.tasks?.filter((t: any) => t.completed)?.length || 0), 0)
    const completedGoals = flatItems.filter(i => i.layer === 3 && (completionMap[i.id] || 0) >= 100).length

    const xp =
      completedTasks * XP_PER_TASK +
      completedDeeds * XP_PER_DEED +
      completedGoals * XP_PER_GOAL

    const level = Math.floor(Math.sqrt(xp / 100)) + 1
    const xpForCurrent = Math.pow(level - 1, 2) * 100
    const xpForNext = Math.pow(level, 2) * 100
    const xpProgress = xpForNext > xpForCurrent ? ((xp - xpForCurrent) / (xpForNext - xpForCurrent)) * 100 : 100

    // Streak calculation (consecutive days with completed deeds)
    const today = new Date()
    let streak = 0
    for (let i = 0; i < 365; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = format(date, 'yyyy-MM-dd')
      const deedsOnDay = deeds.filter(d =>
        d.startDate && format(new Date(d.startDate), 'yyyy-MM-dd') === dateStr
      )
      const completedOnDay = deedsOnDay.filter(d => (completionMap[d.id] || 0) >= 100)
      if (completedOnDay.length > 0) streak++
      else if (i > 0) break
    }

    // Sections covered
    const sections = new Set(flatItems.filter(i => i.layer === 2).map(i => i.category).filter(Boolean))
    const sectionsCovered = sections.size

    // Perfect days
    const perfectDays = dailyScore?.score === 100 ? 1 : 0

    const stats = { totalDeeds, completedDeeds, totalTasks, completedTasks, completedGoals, xp, level, xpProgress, streak, sectionsCovered, perfectDays }
    return stats
  }, [flatItems, completionMap, dailyScore])

  const achievements = useMemo(() => {
    return ACHIEVEMENTS.map(a => ({
      ...a,
      unlocked: a.check(gamification),
    }))
  }, [gamification])

  const unlockedCount = achievements.filter(a => a.unlocked).length
  const levelTitle = LEVEL_TITLES[Math.min(gamification.level - 1, LEVEL_TITLES.length - 1)] || 'Legend'

  const handleSeed = async () => {
    setSeeding(true)
    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      if (res.ok) window.location.reload()
    } finally { setSeeding(false) }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-full space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center animate-pulse">
        <span className="text-3xl font-display font-bold text-gold">I</span>
      </div>
      <p className="text-sm text-ink/40 animate-pulse">Loading your journey...</p>
    </div>
  )

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-8 p-6">
        {/* Gamified Empty State */}
        <div className="relative">
          <div className="w-28 h-28 rounded-[32px] bg-gradient-to-br from-gold/20 to-gold/5 flex items-center justify-center animate-pulseGlow border border-gold/20 shadow-xl shadow-gold/10">
            <span className="text-5xl font-display font-bold bg-gradient-to-br from-gold to-gold-glow bg-clip-text text-transparent">I</span>
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-sage flex items-center justify-center animate-float">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
        </div>

        <div className="text-center space-y-3 max-w-md">
          <h1 className="text-4xl sm:text-5xl font-display font-bold">
            <span className="bg-gradient-to-r from-gold to-gold-glow bg-clip-text text-transparent">Inchstone</span>
          </h1>
          <p className="text-ink/60 text-sm sm:text-base leading-relaxed">
            Your daily deeds flow from your yearly vision. Let's build your framework one step at a time.
          </p>
        </div>

        <button
          onClick={handleSeed}
          disabled={seeding}
          className="px-8 py-4 bg-gradient-to-r from-gold to-gold-glow text-surface font-bold rounded-2xl hover:shadow-xl hover:shadow-gold/20 active:scale-95 transition-all min-h-[52px] text-sm sm:text-base flex items-center justify-center space-x-2"
        >
          <Sparkles className="w-5 h-5" />
          <span>{seeding ? 'Seeding...' : 'Begin Your Quest'} 🎮</span>
        </button>

        <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
          {[
            { label: 'Set Vision', icon: Target },
            { label: 'Build Habits', icon: Zap },
            { label: 'Level Up', icon: TrendingUp },
          ].map((item) => {
            const Icon = item.icon
            return (
              <div key={item.label} className="flex flex-col items-center space-y-2 p-3 rounded-2xl bg-white/5 border border-white/10">
                <div className="p-2.5 rounded-xl bg-gold/10 text-gold">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-semibold text-ink/50 text-center">{item.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Get today's deeds
  const todayDeeds = flatItems.filter(
    i => i.layer === 5 && i.startDate && format(new Date(i.startDate), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
  )

  const stats = [
    { label: 'Yearly Vision', value: `${Math.round(totalCompletion)}%`, icon: Crown, color: 'gold', bg: 'bg-gold/20' },
    { label: 'Quarters', value: `${completeByLayer(2)}/${countByLayer(2)}`, icon: BarChart3, color: 'coral', bg: 'bg-coral/20' },
    { label: 'Monthly Goals', value: `${completeByLayer(3)}/${countByLayer(3)}`, icon: Target, color: 'sage', bg: 'bg-sage/20' },
    { label: 'Today', value: dailyScore ? `${dailyScore.score}%` : '—', icon: ListTodo, color: 'gold', bg: 'bg-gold/20' },
  ]

  return (
    <>
      {/* Gamified Motion Background */}
      <div className="gamified-bg">
        <div className="gamified-grid" />
        <div className="gamified-orb gamified-orb-1" />
        <div className="gamified-orb gamified-orb-2" />
        <div className="gamified-orb gamified-orb-3" />
        <div className="gamified-orb gamified-orb-4" />
        <div className="gamified-star" />
        <div className="gamified-star" />
        <div className="gamified-star" />
        <div className="gamified-star" />
        <div className="gamified-star" />
        <div className="gamified-star" />
        <div className="gamified-star" />
        <div className="gamified-star" />
        <div className="gamified-star" />
        <div className="gamified-star" />
        <div className="gamified-star" />
        <div className="gamified-star" />
        <div className="gamified-star" />
        <div className="gamified-star" />
        <div className="gamified-star" />
      </div>

      <div className="space-y-5 sm:space-y-7 max-w-6xl mx-auto pb-24 lg:pb-0 relative z-10">
        {/* ── Player Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="level-badge">
              <span>{gamification.level}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-display font-bold text-ink">
                  {greeting} 👋
                </h1>
                <span className="xp-badge">
                  <Star className="w-3 h-3" />
                  Lv.{gamification.level} {levelTitle}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-ink/50 mt-0.5">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="streak-flame hidden sm:flex">
              <Flame className="w-4 h-4 flame-icon" />
              <span>{gamification.streak} day streak</span>
            </div>
            <button
              onClick={() => router.push(`/day/${format(new Date(), 'yyyy-MM-dd')}`)}
              className="flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-gold to-gold-glow text-surface rounded-xl hover:shadow-lg hover:shadow-gold/20 active:scale-95 transition text-xs sm:text-sm font-bold min-h-[36px]"
            >
              <CalendarDays className="w-4 h-4" />
              <span>Today</span>
            </button>
            <button
              onClick={() => router.push('/partners')}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-sage/10 text-sage rounded-xl hover:bg-sage/20 active:scale-95 transition text-xs sm:text-sm font-semibold min-h-[36px]"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Partners</span>
            </button>
          </div>
        </div>

        {/* ── XP Bar ── */}
        <div className="glass-strong rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-gold" />
              <span className="text-xs font-bold text-ink/70 uppercase tracking-wider">Experience</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-ink/50">
                <span className="text-gold font-bold">{gamification.xp.toLocaleString()}</span> XP
              </span>
              <span className="text-[10px] text-ink/40">
                Lv.{gamification.level} → Lv.{gamification.level + 1}
              </span>
            </div>
          </div>
          <div className="xp-bar">
            <div className="xp-bar-fill" style={{ width: `${Math.min(gamification.xpProgress, 100)}%` }} />
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-[10px] text-ink/40 italic">{quote}</p>
            <div className="flex items-center gap-1 text-[10px] text-ink/40">
              <Award className="w-3 h-3" />
              <span>{unlockedCount}/{achievements.length} achievements</span>
            </div>
          </div>
        </div>

        {/* ── Incoming Nudges ── */}
        {nudges.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-xs font-bold text-ink/50 uppercase tracking-wider">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Messages ({nudges.length})</span>
            </div>
            {nudges.slice(0, 2).map(nudge => (
              <div key={nudge.id} className="bg-gradient-to-r from-sage/[0.08] to-transparent border border-sage/20 rounded-2xl p-4 flex items-start justify-between active:scale-[0.99] transition-transform">
                <div className="flex items-start space-x-3 flex-1 min-w-0">
                  <div className="p-2.5 bg-sage/20 rounded-xl text-sage shrink-0">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink">{nudge.partner?.name || 'Partner'}</p>
                    <p className="text-sm text-ink/70 line-clamp-2 mt-0.5">"{nudge.message}"</p>
                    <p className="text-[10px] text-ink/40 mt-1 font-mono">{format(new Date(nudge.createdAt), 'MMM d, h:mm a')}</p>
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
                    } catch (e) { console.error(e) }
                  }}
                  className="p-2 text-ink/30 hover:text-ink hover:bg-mist rounded-lg active:scale-90 transition min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {nudges.length > 2 && (
              <button
                onClick={() => router.push('/partners')}
                className="text-xs font-semibold text-sage hover:text-sage/80 active:scale-95 transition flex items-center space-x-1 px-1"
              >
                <span>View all messages</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* ── Stats Grid (Gamified) ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((stat, idx) => {
            const Icon = stat.icon
            return (
              <div key={idx} className="stat-card" style={{ animationDelay: `${idx * 0.1}s` }}>
                <div className={`absolute top-0 right-0 w-24 h-24 -mr-6 -mt-6 rounded-full ${stat.bg} opacity-50 blur-2xl`} />
                <div className="relative">
                  <div className={`p-2.5 rounded-xl ${stat.bg} text-${stat.color} w-fit mb-3`}>
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <p className="text-[10px] sm:text-xs text-ink/50 font-semibold uppercase tracking-wider">{stat.label}</p>
                  <p className="text-xl sm:text-2xl font-bold text-ink font-mono mt-1">{stat.value}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Achievements Row ── */}
        {achievements.filter(a => a.unlocked).length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4 text-gold" />
              <h2 className="text-sm font-bold text-ink/70 uppercase tracking-wider">Achievements Unlocked</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {achievements.filter(a => a.unlocked).slice(0, 6).map(a => {
                const Icon = a.icon
                return (
                  <div key={a.id} className="achievement-card unlocked flex items-center gap-2 px-3 py-2">
                    <Icon className="w-4 h-4 text-gold" />
                    <span className="text-xs font-semibold text-ink/80">{a.label}</span>
                  </div>
                )
              })}
              {achievements.filter(a => a.unlocked).length > 6 && (
                <div className="flex items-center px-3 py-2 text-xs text-ink/40">
                  +{achievements.filter(a => a.unlocked).length - 6} more
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* ── Goal Hierarchy & Monthly ── */}
          <div className="lg:col-span-2 space-y-5">
            {/* Goal Hierarchy */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base sm:text-lg font-bold text-ink">🎯 Quest Progress</h2>
                <button
                  onClick={() => router.push('/year')}
                  className="text-xs font-semibold text-gold hover:text-gold/80 active:scale-95 transition flex items-center space-x-1"
                >
                  <span>View all</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {whyItem && (
                  <div
                    className="rounded-2xl bg-gradient-to-br from-gold/5 to-transparent border border-gold/20 p-4 cursor-pointer hover:border-gold/40 active:scale-[0.98] transition-all"
                    onClick={() => router.push('/year')}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <Crown className="w-3.5 h-3.5 text-gold" />
                          <span className="text-[10px] font-bold text-gold uppercase tracking-wider">Main Quest</span>
                        </div>
                        <p className="font-bold text-sm truncate text-ink">{whyItem.title}</p>
                      </div>
                      <div className="relative">
                        <div className="w-11 h-11 rounded-full flex items-center justify-center border-2 border-gold/30">
                          <span className="text-xs font-bold text-gold font-mono">{Math.round(totalCompletion)}%</span>
                        </div>
                        {totalCompletion >= 100 && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-sage rounded-full flex items-center justify-center">
                            <CheckCircle className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[10px] text-ink/50">
                      <span>{completeByLayer(5)}/{countByLayer(5)} deeds done</span>
                      <span className="font-mono font-bold text-gold">+{gamification.xp} XP</span>
                    </div>
                    <div className="mt-2 w-full h-1.5 bg-mist rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-gold to-gold-glow rounded-full transition-all animate-progressPulse" style={{ width: `${totalCompletion}%` }} />
                    </div>
                  </div>
                )}
                {flatItems.filter(i => i.layer === 2).slice(0, 3).map(q => (
                  <div
                    key={q.id}
                    className="rounded-2xl bg-white/5 border border-white/10 p-4 cursor-pointer hover:border-coral/30 active:scale-[0.98] transition-all"
                    onClick={() => router.push('/year')}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2 min-w-0">
                        <Sword className="w-3.5 h-3.5 text-coral shrink-0" />
                        <span className="text-[10px] font-bold text-coral uppercase tracking-wider truncate">Side Quest</span>
                      </div>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center border border-coral/30">
                        <span className="text-[10px] font-bold text-coral font-mono">{Math.round(completionMap[q.id] || 0)}%</span>
                      </div>
                    </div>
                    <p className="font-bold text-sm truncate text-ink">{q.title}</p>
                    <div className="mt-2 w-full h-1 bg-mist rounded-full overflow-hidden">
                      <div className="h-full bg-coral rounded-full transition-all" style={{ width: `${completionMap[q.id] || 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly Milestones */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base sm:text-lg font-bold text-ink">📋 Monthly Quests</h2>
              </div>
              <div className="space-y-2">
                {flatItems.filter(i => i.layer === 3).slice(0, 5).map(ms => {
                  const pct = completionMap[ms.id] || 0
                  return (
                    <div
                      key={ms.id}
                      className={`quest-item ${pct >= 100 ? 'completed' : ''}`}
                      onClick={() => router.push('/year')}
                    >
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${pct >= 100 ? 'bg-sage border-sage' : 'border-gold/40'}`}>
                        {pct >= 100 ? <CheckCircle className="w-3.5 h-3.5 text-white" /> : <span className="text-[9px] font-bold text-gold">{Math.round(pct)}%</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${pct >= 100 ? 'line-through text-ink/40' : 'text-ink'}`}>{ms.title}</p>
                        {ms.startDate && (
                          <p className="text-[10px] text-ink/40 mt-0.5">
                            {format(new Date(ms.startDate), 'MMM d')} — {ms.endDate && format(new Date(ms.endDate), 'MMM d')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-3 shrink-0">
                        <div className="w-16 sm:w-20 h-1.5 bg-mist rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-sage' : 'bg-gold'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-mono text-ink/50 w-8 text-right font-bold">{Math.round(pct)}%</span>
                      </div>
                    </div>
                  )
                })}
                {flatItems.filter(i => i.layer === 3).length === 0 && (
                  <div className="p-6 text-center text-sm text-ink/40 rounded-2xl bg-white/[0.03] border border-dashed border-white/[0.08]">
                    No quests yet. Set your first monthly goal!
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Today's Overview ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-bold text-ink">Today's Deeds</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push(`/day/${format(new Date(), 'yyyy-MM-dd')}`)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-sage/10 text-sage hover:bg-sage/20 active:scale-95 transition text-[10px] font-bold"
                >
                  <CalendarDays className="w-3 h-3" />
                  <span>Open Day</span>
                </button>
                <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-gold/10 text-gold text-[10px] font-bold">
                  <CalendarDays className="w-3 h-3" />
                  <span>{format(new Date(), 'MMM d')}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
              {todayDeeds.length > 0 ? (
                <div className="divide-y divide-white/[0.06]">
                  {todayDeeds.slice(0, 5).map(deed => {
                    const pct = completionMap[deed.id] || 0
                    const tasks = deed.tasks || []
                    const doneTasks = tasks.filter((t: any) => t.completed).length
                    return (
                      <div
                        key={deed.id}
                        className="quest-item rounded-none border-0"
                        onClick={() => router.push('/calendar')}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${pct >= 100 ? 'bg-sage border-sage' : 'border-gold/40'}`}>
                          {pct >= 100 ? <CheckCircle className="w-3 h-3 text-white" /> : null}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm font-medium truncate block ${pct >= 100 ? 'line-through text-ink/40' : 'text-ink'}`}>
                            {deed.title}
                          </span>
                          {tasks.length > 0 && (
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-1 bg-mist rounded-full overflow-hidden">
                                <div className="h-full bg-sage rounded-full transition-all" style={{ width: `${(doneTasks / tasks.length) * 100}%` }} />
                              </div>
                              <span className="text-[9px] text-ink/40 font-mono">{doneTasks}/{tasks.length}</span>
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-ink/50 shrink-0 font-bold">{Math.round(pct)}%</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto mb-3">
                    <Sun className="w-6 h-6 text-gold" />
                  </div>
                  <p className="text-sm font-medium text-ink/60">No deeds for today</p>
                  <p className="text-xs text-ink/40 mt-1">Add tasks to your calendar</p>
                </div>
              )}
              <div className="p-3 bg-white/[0.02] border-t border-white/[0.06]">
                <button
                  onClick={() => router.push('/calendar')}
                  className="w-full text-xs font-semibold text-gold hover:text-gold/80 active:scale-[0.98] transition flex items-center justify-center space-x-1.5 py-1"
                >
                  <span>View calendar</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* ── Quick Actions ── */}
            <div className="rounded-2xl bg-gradient-to-br from-gold/5 to-transparent border border-gold/10 p-4">
              <div className="flex items-center space-x-2 mb-3">
                <Zap className="w-4 h-4 text-gold" />
                <span className="text-xs font-bold text-ink/70 uppercase tracking-wider">Quick Actions</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => router.push('/year')}
                  className="flex items-center space-x-2 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 transition text-left"
                >
                  <Target className="w-4 h-4 text-sage" />
                  <span className="text-xs font-medium text-ink">Goals</span>
                </button>
                <button
                  onClick={() => router.push('/finance')}
                  className="flex items-center space-x-2 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 transition text-left"
                >
                  <DollarSign className="w-4 h-4 text-gold" />
                  <span className="text-xs font-medium text-ink">Finance</span>
                </button>
                <button
                  onClick={() => router.push('/partners')}
                  className="flex items-center space-x-2 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 transition text-left"
                >
                  <Users className="w-4 h-4 text-coral" />
                  <span className="text-xs font-medium text-ink">Partners</span>
                </button>
                <button
                  onClick={() => router.push('/transactions')}
                  className="flex items-center space-x-2 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 transition text-left"
                >
                  <BarChart3 className="w-4 h-4 text-sage" />
                  <span className="text-xs font-medium text-ink">Analysis</span>
                </button>
              </div>
            </div>

            {/* ── Achievements Preview ── */}
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-gold" />
                <span className="text-xs font-bold text-ink/70 uppercase tracking-wider">Achievements</span>
              </div>
              <div className="space-y-2">
                {achievements.slice(0, 4).map(a => {
                  const Icon = a.icon
                  return (
                    <div key={a.id} className={`flex items-center gap-3 ${a.unlocked ? '' : 'opacity-40'}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${a.unlocked ? 'bg-gold/20 text-gold' : 'bg-white/5 text-ink/30'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold ${a.unlocked ? 'text-ink' : 'text-ink/40'}`}>{a.label}</p>
                        <p className="text-[9px] text-ink/30">{a.desc}</p>
                      </div>
                      {a.unlocked && <CheckCircle className="w-3.5 h-3.5 text-sage shrink-0" />}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}