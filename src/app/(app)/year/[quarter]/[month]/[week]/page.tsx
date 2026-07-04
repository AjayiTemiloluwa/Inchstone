'use client'

import { useEffect, useState, useCallback } from 'react'
import { useHierarchyStore, Item } from '@/store/hierarchyStore'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useRouter, useParams } from 'next/navigation'
import { ChevronRight, Plus, X, Trash2, BookOpen, Download } from 'lucide-react'
import { format, addDays } from 'date-fns'
import { useToast } from '@/components/ui/ToastProvider'

export default function YearQuarterMonthWeekPage() {
    const router = useRouter()
    const params = useParams()
    const quarterLabel = params.quarter as string
    const monthLabel = params.month as string
    const weekSlug = params.week as string // e.g. "Week1"

    // Convert slug back to title: "Week1" -> "Week 1"
    const weekTitle = weekSlug.replace(/Week(\d+)/i, 'Week $1')

    const { items, completionMap, setItems, updateItem, getFlatItems } = useHierarchyStore()
    const { showToast, confirm } = useToast()
    const [loading, setLoading] = useState(true)

    const [addingGoal, setAddingGoal] = useState<string | null>(null)
    const [newGoalTitle, setNewGoalTitle] = useState('')

    const [reflectionText, setReflectionText] = useState('')
    const [reflectionTimer, setReflectionTimer] = useState<NodeJS.Timeout | null>(null)

    const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    const fetchItems = useCallback(async () => {
        const res = await fetch('/api/items?t=' + Date.now())
        const data = await res.json()
        if (data.items) {
            const itemMap = new Map()
            data.items.forEach((item: any) => itemMap.set(item.id, { ...item, children: [], tasks: item.tasks || [] }))
            const tree: any[] = []
            data.items.forEach((item: any) => {
                if (item.parentId) { const parent = itemMap.get(item.parentId); if (parent) parent.children.push(itemMap.get(item.id)) }
                else { tree.push(itemMap.get(item.id)) }
            })
            setItems(tree)
        }
    }, [setItems])

    useEffect(() => {
        fetchItems().finally(() => setLoading(false))
    }, [fetchItems])

    const flatItems = getFlatItems()

    const yearItem = flatItems.find(i => i.layer === 0)
    const categories = flatItems.filter(i => i.layer === 1 && i.parentId === yearItem?.id)
    const yearlyGoals = flatItems.filter(i => i.layer === 2)
    const matchingQuarters = flatItems.filter(i => i.layer === 3 && i.title.includes(quarterLabel))

    // Find the specific month matching both quarter and month label
    const matchingMonths = matchingQuarters.flatMap(q =>
        q.children?.filter(c => c.layer === 4 && c.title === monthLabel) || []
    )

    // Find only the weeks in THIS specific month that match the week title
    const matchingWeeks = matchingMonths.flatMap(m =>
        m.children?.filter(c => c.layer === 5 && c.title === weekTitle) || []
    )

    // Filter to only include weeks whose date range actually falls within the requested month
    const filteredWeeks = matchingWeeks.filter(week => {
        if (!week.startDate) return false
        const weekStart = new Date(week.startDate)
        const weekMonth = weekStart.getMonth() // 0-11
        const weekYear = weekStart.getFullYear()

        // Find the month item to get its date range
        const monthItem = matchingMonths[0]
        if (!monthItem?.startDate) return true // If no date on month, include all

        const mStart = new Date(monthItem.startDate)
        const mEnd = monthItem.endDate ? new Date(monthItem.endDate) : new Date(mStart.getFullYear(), mStart.getMonth() + 1, 0)

        // Check if week overlaps with month
        const wEnd = week.endDate ? new Date(week.endDate) : weekStart
        return weekStart <= mEnd && wEnd >= mStart
    })

    // Auto-create days if none exist for each week
    const ensureDays = useCallback(async () => {
        let changed = false
        for (const weekItem of matchingWeeks) {
            const dailyGoals = weekItem.children?.filter(c => c.layer === 6) || []
            if (dailyGoals.length === 0 && weekItem.startDate) {
                changed = true
                const wStart = new Date(weekItem.startDate)
                const wEnd = new Date(weekItem.endDate || weekItem.startDate)

                // Calculate how many days in this week
                const dayCount = Math.round((wEnd.getTime() - wStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
                const perWeight = Math.round((100 / dayCount) * 10) / 10

                for (let d = 0; d < dayCount; d++) {
                    const dayDate = addDays(wStart, d)
                    const dayName = WEEKDAYS[dayDate.getDay()]
                    const dateStr = format(dayDate, 'yyyy-MM-dd')
                    await fetch('/api/items', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ layer: 6, parentId: weekItem.id, title: dayName, weight: perWeight, startDate: dateStr, endDate: dateStr })
                    })
                }
            }
        }
        if (changed) {
            await fetchItems()
        }
    }, [matchingWeeks, fetchItems])

    useEffect(() => {
        if (!loading && matchingWeeks.length > 0) {
            const needsDays = matchingWeeks.some(w => (w.children?.filter(c => c.layer === 6) || []).length === 0)
            if (needsDays) {
                ensureDays()
            }
        }
    }, [loading, matchingWeeks, ensureDays])

    // Reflection
    useEffect(() => {
        if (matchingWeeks.length > 0 && matchingWeeks[0].reflection && reflectionText === '') {
            setReflectionText(matchingWeeks[0].reflection)
        }
    }, [matchingWeeks, reflectionText])

    const saveReflection = useCallback((text: string) => {
        if (matchingWeeks.length === 0) return
        if (reflectionTimer) clearTimeout(reflectionTimer)
        const timer = setTimeout(() => {
            updateItem(matchingWeeks[0].id, { reflection: text })
        }, 800)
        setReflectionTimer(timer)
    }, [matchingWeeks, updateItem, reflectionTimer])

    const handleAddGoal = async (categoryId: string) => {
        if (!newGoalTitle.trim()) return
        try {
            const goalRes = await fetch('/api/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    layer: 2,
                    parentId: categoryId,
                    title: newGoalTitle.trim(),
                    weight: 0,
                    startDate: yearItem?.startDate || new Date().toISOString(),
                    endDate: yearItem?.endDate || new Date().toISOString(),
                })
            })
            const goalData = await goalRes.json()

            if (goalData.success && goalData.item) {
                const quartersToCreate = [
                    { title: 'Q1 Objective', startMonth: 0, endMonth: 2 },
                    { title: 'Q2 Objective', startMonth: 3, endMonth: 5 },
                    { title: 'Q3 Objective', startMonth: 6, endMonth: 8 },
                    { title: 'Q4 Objective', startMonth: 9, endMonth: 11 },
                ]
                const year = new Date(yearItem?.startDate || new Date()).getFullYear()
                await Promise.all(quartersToCreate.map(q => {
                    const qStart = new Date(year, q.startMonth, 1)
                    const qEnd = new Date(year, q.endMonth + 1, 0)
                    return fetch('/api/items', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            layer: 3, parentId: goalData.item.id, title: q.title, weight: 25,
                            startDate: qStart.toISOString(), endDate: qEnd.toISOString(),
                        })
                    })
                }))
            }

            await fetchItems()
            setNewGoalTitle('')
            setAddingGoal(null)
        } catch (e) { console.error(e) }
    }

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        if (!(await confirm('Are you sure you want to delete this?'))) return
        try {
            const res = await fetch(`/api/items/${id}`, { method: 'DELETE' })
            if (!res.ok) { showToast('Failed to delete item', 'error') }
            else { await fetchItems(); showToast('Item deleted', 'success') }
        } catch (e) { console.error(e) }
    }

    const handleDownloadReport = async () => {
        const element = document.getElementById('report-content')
        if (!element) return

        const opt = {
            margin: 0.5,
            filename: `${weekTitle}_Report.pdf`,
            image: { type: 'jpeg', quality: 0.98 } as const,
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } as const
        }

        try {
            showToast('Generating PDF Report...', 'info')
            const html2pdf = (await import('html2pdf.js')).default
            await html2pdf().set(opt as any).from(element).save()
            showToast('PDF Report downloaded successfully', 'success')
        } catch (err) {
            console.error('PDF export failed:', err)
            showToast('Failed to export PDF', 'error')
        }
    }

    const avgScore = matchingWeeks.length > 0
        ? matchingWeeks.reduce((s, w) => s + (completionMap[w.id] || 0), 0) / matchingWeeks.length
        : 0

    if (loading) return <div className="flex justify-center items-center h-full"><span className="text-ink/60">Loading...</span></div>
    if (categories.length === 0) return <div className="p-6 text-ink/60">No categories found. Seed the framework first.</div>

    // Build day groups across all matching weeks
    const allDays = matchingWeeks.flatMap(w => w.children?.filter(c => c.layer === 6) || [])

    // Collect days and sort them chronologically by date
    const dayMap = new Map<string, { items: Item[], avgScore: number, dateLabel: string, categories: string[] }>()
    allDays.forEach(d => {
        if (!dayMap.has(d.title)) {
            dayMap.set(d.title, { items: [], avgScore: 0, dateLabel: '', categories: [] })
        }
        const entry = dayMap.get(d.title)!
        entry.items.push(d)

        // Find which categories this day's tasks belong to
        const taskCategories = (d.tasks || [])
            .filter(t => t.categoryId)
            .map(t => {
                const cat = categories.find(c => c.id === t.categoryId)
                return cat?.title
            })
            .filter((cat): cat is string => Boolean(cat))

        // Add unique categories
        taskCategories.forEach(cat => {
            if (!entry.categories.includes(cat)) {
                entry.categories.push(cat)
            }
        })
    })

    // Sort days chronologically by their date
    const sortedDayNames = Array.from(dayMap.keys()).sort((a, b) => {
        const aItems = dayMap.get(a)!.items
        const bItems = dayMap.get(b)!.items
        if (aItems.length === 0 || bItems.length === 0) return 0
        const aDate = new Date(aItems[0].startDate || 0).getTime()
        const bDate = new Date(bItems[0].startDate || 0).getTime()
        return aDate - bDate
    })

    const dayGroups = sortedDayNames.map(name => {
        const entry = dayMap.get(name)!
        const avg = entry.items.length > 0 ? entry.items.reduce((s, d) => s + (completionMap[d.id] || 0), 0) / entry.items.length : 0
        const firstItem = entry.items[0]
        const dateLabel = firstItem?.startDate ? format(new Date(firstItem.startDate), 'MMM d') : ''
        return { title: name, items: entry.items, avgScore: avg, dateLabel, categories: entry.categories }
    })

    // Get date range label for the week header
    let weekDateRange = ''
    if (matchingWeeks.length > 0 && matchingWeeks[0].startDate && matchingWeeks[0].endDate) {
        const s = new Date(matchingWeeks[0].startDate)
        const e = new Date(matchingWeeks[0].endDate)
        weekDateRange = `${format(s, 'MMM d, yyyy')} – ${format(e, 'MMM d, yyyy')}`
    }

    return (
        <div className="space-y-8 max-w-full pb-12 stagger-children" id="report-content">
            {/* Breadcrumb */}
            <div className="flex items-center space-x-2 text-sm text-ink/50 flex-wrap">
                <button onClick={() => router.push('/year')} className="hover:text-gold transition">Year</button>
                <ChevronRight className="w-3 h-3" />
                <button onClick={() => router.push(`/year/${quarterLabel}`)} className="hover:text-gold transition">{quarterLabel}</button>
                <ChevronRight className="w-3 h-3" />
                <button onClick={() => router.push(`/year/${quarterLabel}/${monthLabel}`)} className="hover:text-gold transition">{monthLabel}</button>
                <ChevronRight className="w-3 h-3" />
                <span className="text-ink font-bold">{weekTitle}</span>
            </div>

            {/* Week Header */}
            <div className="glass-gold glow-sm rounded-3xl p-8 animate-slideUp border border-gold/20">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-display font-bold bg-gradient-to-r from-gold to-gold-glow bg-clip-text text-transparent">{weekTitle}</h1>
                        <p className="text-sm text-ink/70 mt-2 font-mono">
                            {monthLabel} · {quarterLabel}{weekDateRange ? ` · ${weekDateRange}` : ''}
                        </p>
                    </div>
                    <div className="flex items-center space-x-6">
                        <button onClick={handleDownloadReport} className="px-4 py-2.5 bg-black/20 text-gold border border-gold/30 text-sm font-bold rounded-xl hover:bg-gold/10 transition-all flex items-center space-x-2">
                            <Download className="w-4 h-4" />
                            <span className="hidden sm:inline">Report</span>
                        </button>
                        <ProgressRing progress={avgScore} size={72} />
                    </div>
                </div>
            </div>

            {/* Categories & Goals Section */}
            <div>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-3xl font-display font-bold text-ink">Categories & Goals</h2>
                </div>

                <div className="space-y-6">
                    {categories.map(category => {
                        const catScore = completionMap[category.id] || 0
                        const catYearlyGoals = yearlyGoals.filter(g => g.parentId === category.id)
                        const catQuarters = matchingQuarters.filter(q => catYearlyGoals.some(yg => yg.id === q.parentId))
                        const catMonths = catQuarters.flatMap(q => q.children?.filter(c => c.layer === 4 && c.title === monthLabel) || [])
                        const catWeeks = catMonths.flatMap(m => m.children?.filter(c => c.layer === 5 && c.title === weekTitle) || [])

                        return (
                            <Card key={category.id} className="p-5 space-y-4">
                                {/* Category Header */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-bold text-ink">{category.title}</h3>
                                        <div className="flex items-center space-x-3">
                                            <div className="flex items-center space-x-1">
                                                <span className="text-[10px] font-bold text-ink/50 uppercase tracking-wider">Score:</span>
                                                <span className="text-sm font-mono font-bold bg-white/10 px-2 py-0.5 rounded text-ink/80">{Math.round(catScore)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                    <ProgressBar progress={catScore} colorClass="bg-sage" />
                                </div>

                                {/* Weekly Goals */}
                                <div className="space-y-3 pt-2 border-t border-mist">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold uppercase text-ink/50">Weekly Goals</span>
                                        <button onClick={() => setAddingGoal(addingGoal === category.id ? null : category.id)} className="p-1 hover:bg-mist rounded-lg transition text-ink/50 hover:text-gold">
                                            {addingGoal === category.id ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>

                                    {addingGoal === category.id && (
                                        <div className="flex items-center space-x-2 animate-fadeIn mb-3">
                                            <input type="text" value={newGoalTitle} onChange={e => setNewGoalTitle(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleAddGoal(category.id)}
                                                placeholder={`New annual goal in ${category.title}...`} className="flex-1 px-4 py-2.5 text-sm bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-ink/30 transition-all" autoFocus />
                                            <button onClick={() => handleAddGoal(category.id)} className="px-4 py-2.5 bg-gold text-paper text-sm font-bold rounded-xl hover:bg-gold-glow transition-all active:scale-95 shadow-lg shadow-gold/20">Add</button>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {catWeeks.map(wItem => {
                                            const wScore = completionMap[wItem.id] || 0
                                            // Walk up to find the yearly goal name
                                            const parentMonth = catMonths.find(m => m.id === wItem.parentId)
                                            const parentQ = catQuarters.find(q => q.id === parentMonth?.parentId)
                                            const parentYG = catYearlyGoals.find(yg => yg.id === parentQ?.parentId)

                                            return (
                                                <Card key={wItem.id} className="p-4 hover:border-gold transition-colors group relative cursor-pointer" onClick={() => router.push(`/week/${wItem.id}`)}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h4 className="font-bold text-ink text-sm truncate pr-6">{parentYG?.title}</h4>
                                                        <div className="flex items-center space-x-2">
                                                            <ProgressRing progress={wScore} size={32} />
                                                            <span className="text-base font-mono font-bold">{Math.round(wScore)}%</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4" onClick={e => e.stopPropagation()}>
                                                        <div className="flex-1">
                                                            <span className="text-[9px] text-ink/50 uppercase tracking-wider block mb-0.5">Weight</span>
                                                            <input type="range" min="0" max="100" step={1} value={wItem.weight}
                                                                onChange={e => updateItem(wItem.id, { weight: parseFloat(e.target.value) || 0 })}
                                                                className="w-full h-1.5 bg-mist rounded-full appearance-none cursor-pointer accent-gold" />
                                                            <span className="text-[9px] font-mono text-ink/50">{Math.round(wItem.weight || 0)}%</span>
                                                        </div>
                                                        <div className="flex-1">
                                                            <span className="text-[9px] text-ink/50 uppercase tracking-wider block mb-0.5">Score</span>
                                                            <input type="range" min="0" max="100" step={1} value={Math.round(wScore)}
                                                                onChange={e => updateItem(wItem.id, { progress: parseFloat(e.target.value) || 0 })}
                                                                className="w-full h-1.5 bg-mist rounded-full appearance-none cursor-pointer accent-sage" />
                                                            <span className="text-[9px] font-mono text-ink/50">{Math.round(wScore)}%</span>
                                                        </div>
                                                    </div>
                                                    <button onClick={(e) => handleDelete(e, wItem.id)} className="absolute top-2 right-2 p-1.5 bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded-lg transition text-ink/50 hover:text-red-400 z-10" title="Delete">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </Card>
                                            )
                                        })}
                                    </div>
                                    {catWeeks.length === 0 && !addingGoal && (
                                        <p className="text-xs text-ink/40 italic">No goals for this week in this category.</p>
                                    )}
                                </div>
                            </Card>
                        )
                    })}
                </div>
            </div>

            {/* Week Reflection */}
            <div>
                <div className="flex items-center space-x-2 mb-4">
                    <BookOpen className="w-5 h-5 text-gold" />
                    <h2 className="text-2xl font-display font-bold text-ink">{weekTitle} Reflection</h2>
                </div>
                <Card className="p-6">
                    <textarea value={reflectionText}
                        onChange={(e) => { setReflectionText(e.target.value); saveReflection(e.target.value) }}
                        placeholder={`Reflect on ${weekTitle}... What went well? What will you improve?`}
                        className="w-full h-48 bg-black/20 border border-white/10 rounded-xl p-5 text-sm text-ink resize-none focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/30 placeholder:text-ink/30 transition-all" />
                    <p className="text-[10px] text-ink/40 mt-2">Auto-saves as you type</p>
                </Card>
            </div>

            {/* Days Section */}
            <div>
                <h2 className="text-3xl font-display font-bold text-ink mb-6">Days</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                    {dayGroups.map(({ title, items: dItems, avgScore, dateLabel, categories: dayCategories }) => {
                        // Get the date from the first day item to navigate to
                        const firstDate = dItems[0]?.startDate ? format(new Date(dItems[0].startDate), 'yyyy-MM-dd') : null

                        return (
                            <Card
                                key={title}
                                className={`p-4 transition-colors group hover:border-gold ${firstDate ? 'cursor-pointer' : ''}`}
                                onClick={() => firstDate && router.push(`/day/${firstDate}`)}
                            >
                                <div className="text-center mb-4">
                                    <p className="text-sm font-bold uppercase tracking-widest bg-gradient-to-r from-gold to-gold-glow bg-clip-text text-transparent">{title}</p>
                                    {dateLabel && <p className="text-[10px] text-ink/50 mt-1">{dateLabel}</p>}
                                </div>
                                {dayCategories.length > 0 && (
                                    <div className="flex flex-wrap gap-1 justify-center mb-2">
                                        {dayCategories.slice(0, 3).map((cat, idx) => (
                                            <span key={idx} className="text-[8px] px-1.5 py-0.5 bg-gold/20 text-gold rounded font-bold uppercase">
                                                {cat}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div className="flex flex-col items-center">
                                    <ProgressRing progress={avgScore} size={44} />
                                    <p className="text-lg font-mono font-bold mt-2">{Math.round(avgScore)}%</p>
                                    <p className="text-[10px] text-ink/40">{dItems.length} goals</p>
                                </div>
                            </Card>
                        )
                    })}
                    {dayGroups.length === 0 && (
                        <p className="text-sm text-ink/50 italic col-span-full">Days will appear once goals are created.</p>
                    )}
                </div>
            </div>
        </div>
    )
}
