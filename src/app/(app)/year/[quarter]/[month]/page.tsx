'use client'

import { useEffect, useState, useCallback } from 'react'
import { useHierarchyStore, Item } from '@/store/hierarchyStore'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useRouter, useParams } from 'next/navigation'
import { ChevronRight, Plus, X, Trash2, BookOpen, Download } from 'lucide-react'
import { format } from 'date-fns'
import { useToast } from '@/components/ui/ToastProvider'
import { getWeeksInMonth } from '@/lib/calendarUtils'

export default function YearQuarterMonthPage() {
    const router = useRouter()
    const params = useParams()
    const quarterLabel = params.quarter as string
    const monthLabel = params.month as string

    const { items, completionMap, setItems, updateItem, getFlatItems } = useHierarchyStore()
    const { showToast, confirm } = useToast()
    const [loading, setLoading] = useState(true)

    const [addingGoal, setAddingGoal] = useState<string | null>(null)
    const [newGoalTitle, setNewGoalTitle] = useState('')

    const [reflectionText, setReflectionText] = useState('')
    const [reflectionTimer, setReflectionTimer] = useState<NodeJS.Timeout | null>(null)

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

    // Find all month items matching this month name across all quarters for this quarter label
    const matchingMonths = matchingQuarters.flatMap(q =>
        q.children?.filter(c => c.layer === 4 && c.title === monthLabel) || []
    )

    // Auto-create weeks if none exist for each month
    const ensureWeeks = useCallback(async () => {
        let changed = false
        for (const monthItem of matchingMonths) {
            const weeklyGoals = monthItem.children?.filter(c => c.layer === 5) || []
            if (weeklyGoals.length === 0 && monthItem.startDate) {
                changed = true
                const mStart = new Date(monthItem.startDate)
                const weeksInMonth = getWeeksInMonth(mStart.getFullYear(), mStart.getMonth() + 1)
                const perWeight = Math.round((100 / weeksInMonth.length) * 10) / 10

                for (let w = 0; w < weeksInMonth.length; w++) {
                    const weekDays = weeksInMonth[w]
                    const wStart = weekDays[0].date
                    const wEnd = weekDays[weekDays.length - 1].date
                    const wStartStr = format(wStart, 'yyyy-MM-dd')
                    const wEndStr = format(wEnd, 'yyyy-MM-dd')
                    await fetch('/api/items', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ layer: 5, parentId: monthItem.id, title: `Week ${w + 1}`, weight: perWeight, startDate: wStartStr, endDate: wEndStr })
                    })
                }
            }
        }
        if (changed) {
            await fetchItems()
        }
    }, [matchingMonths, fetchItems])

    useEffect(() => {
        if (!loading && matchingMonths.length > 0) {
            const needsWeeks = matchingMonths.some(m => (m.children?.filter(c => c.layer === 5) || []).length === 0)
            if (needsWeeks) {
                ensureWeeks()
            }
        }
    }, [loading, matchingMonths, ensureWeeks])

    // Reflection
    useEffect(() => {
        if (matchingMonths.length > 0 && matchingMonths[0].reflection && reflectionText === '') {
            setReflectionText(matchingMonths[0].reflection)
        }
    }, [matchingMonths, reflectionText])

    const saveReflection = useCallback((text: string) => {
        if (matchingMonths.length === 0) return
        if (reflectionTimer) clearTimeout(reflectionTimer)
        const timer = setTimeout(() => {
            updateItem(matchingMonths[0].id, { reflection: text })
        }, 800)
        setReflectionTimer(timer)
    }, [matchingMonths, updateItem, reflectionTimer])

    const handleAddGoal = async (categoryId: string) => {
        if (!newGoalTitle.trim()) return
        try {
            const existingGoals = yearlyGoals.filter(g => g.parentId === categoryId)
            const newCount = existingGoals.length + 1
            const equalWeight = Math.round((100 / newCount) * 10) / 10

            const goalRes = await fetch('/api/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    layer: 2,
                    parentId: categoryId,
                    title: newGoalTitle.trim(),
                    weight: equalWeight,
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
        try {
            showToast('Generating PDF Report...', 'info')
            const jsPDF = (await import('jspdf')).default
            const doc = new jsPDF('p', 'mm', 'a4')
            const pageWidth = doc.internal.pageSize.getWidth()
            const margin = 20
            let y = 20

            doc.setFontSize(18)
            doc.setTextColor(212, 175, 55)
            doc.setFont('helvetica', 'bold')
            doc.text(`Month Report: ${monthLabel}`, margin, y)
            y += 10

            doc.setFontSize(11)
            doc.setTextColor(30, 30, 30)
            doc.setFont('helvetica', 'normal')
            doc.text(`Generated on ${format(new Date(), 'MMM d, yyyy')}`, margin, y)
            y += 8

            doc.setDrawColor(200, 200, 200)
            doc.setLineWidth(0.3)
            doc.line(margin, y, pageWidth - margin, y)
            y += 8

            doc.setFontSize(12)
            doc.setTextColor(30, 30, 30)
            doc.setFont('helvetica', 'bold')
            doc.text('Categories & Goals', margin, y)
            y += 7

            categories.forEach(cat => {
                if (y > 270) { doc.addPage(); y = 20 }
                doc.setFontSize(10)
                doc.setTextColor(212, 175, 55)
                doc.setFont('helvetica', 'bold')
                doc.text(cat.title, margin, y)
                y += 5

                const catScore = completionMap[cat.id] || 0
                doc.setFontSize(8)
                doc.setTextColor(30, 30, 30)
                doc.setFont('helvetica', 'normal')
                doc.text(`• Overall progress: ${Math.round(catScore)}%`, margin + 4, y)
                doc.setTextColor(143, 188, 143)
                doc.text(`${Math.round(catScore)}%`, pageWidth - margin, y, { align: 'right' })
                y += 5
                y += 3
            })

            doc.setFontSize(7)
            doc.setTextColor(200, 200, 200)
            doc.setFont('helvetica', 'italic')
            doc.text(`Generated on ${format(new Date(), 'MMM d, yyyy h:mm a')}`, margin, 285)

            doc.save(`${monthLabel}_Report.pdf`)
            showToast('PDF Report downloaded successfully', 'success')
        } catch (err) {
            console.error('PDF export failed:', err)
            showToast('Failed to export PDF', 'error')
        }
    }

    const avgScore = matchingMonths.length > 0
        ? matchingMonths.reduce((s, m) => s + (completionMap[m.id] || 0), 0) / matchingMonths.length
        : 0

    if (loading) return <div className="flex justify-center items-center h-full"><span className="text-ink/60">Loading...</span></div>
    if (categories.length === 0) return <div className="p-6 text-ink/60">No categories found. Seed the framework first.</div>

    // Build week groups across all matching months
    const weekTitlesSet = new Set<string>()
    matchingMonths.forEach(m => {
        (m.children?.filter(c => c.layer === 5) || []).forEach(w => weekTitlesSet.add(w.title))
    })
    const weekTitles = Array.from(weekTitlesSet).sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, '')) || 0
        const numB = parseInt(b.replace(/\D/g, '')) || 0
        return numA - numB
    })

    const weekGroups = weekTitles.map(title => {
        const wItems = matchingMonths.flatMap(m => m.children?.filter(c => c.layer === 5 && c.title === title) || [])
        const avgWeekScore = wItems.length > 0 ? wItems.reduce((s, w) => s + (completionMap[w.id] || 0), 0) / wItems.length : 0
        // Get date range from first item
        const firstItem = wItems[0]
        let dateLabel = ''
        if (firstItem?.startDate && firstItem?.endDate) {
            const s = new Date(firstItem.startDate)
            const e = new Date(firstItem.endDate)
            dateLabel = `${format(s, 'MMM d')} – ${format(e, 'MMM d')}`
        }
        return { title, items: wItems, avgScore: avgWeekScore, dateLabel }
    })

    return (
        <div className="space-y-8 max-w-full pb-12 stagger-children" id="report-content">
            {/* Breadcrumb */}
            <div className="flex items-center space-x-2 text-sm text-ink/50">
                <button onClick={() => router.push('/year')} className="hover:text-gold transition">Year</button>
                <ChevronRight className="w-3 h-3" />
                <button onClick={() => router.push(`/year/${quarterLabel}`)} className="hover:text-gold transition">{quarterLabel}</button>
                <ChevronRight className="w-3 h-3" />
                <span className="text-ink font-bold">{monthLabel}</span>
            </div>

            {/* Month Header */}
            <div className="glass-gold glow-sm rounded-3xl p-8 animate-slideUp border border-gold/20">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-display font-bold bg-gradient-to-r from-gold to-gold-glow bg-clip-text text-transparent">{monthLabel}</h1>
                        <p className="text-sm text-ink/70 mt-2 font-mono">
                            {quarterLabel}
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
                        // Get the month items for this category
                        const catMonths = catQuarters.flatMap(q =>
                            q.children?.filter(c => c.layer === 4 && c.title === monthLabel) || []
                        )

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

                                {/* Monthly Goals */}
                                <div className="space-y-3 pt-2 border-t border-mist">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold uppercase text-ink/50">Monthly Goals</span>
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
                                        {catMonths.map(mItem => {
                                            const mScore = completionMap[mItem.id] || 0
                                            const parentQ = catQuarters.find(q => q.id === mItem.parentId)
                                            const parentYG = catYearlyGoals.find(yg => yg.id === parentQ?.parentId)

                                            return (
                                                <Card key={mItem.id} className="p-4 hover:border-gold transition-colors group relative cursor-pointer" onClick={() => router.push(`/month/${mItem.id}`)}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h4 className="font-bold text-ink text-sm truncate pr-6">{parentYG?.title}</h4>
                                                        <div className="flex items-center space-x-2">
                                                            <ProgressRing progress={mScore} size={32} />
                                                            <span className="text-base font-mono font-bold">{Math.round(mScore)}%</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4" onClick={e => e.stopPropagation()}>
                                                        <div className="flex-1">
                                                            <span className="text-[9px] text-ink/50 uppercase tracking-wider block mb-0.5">Weight</span>
                                                            <input type="range" min="0" max="100" step={1} value={mItem.weight}
                                                                onChange={e => updateItem(mItem.id, { weight: parseFloat(e.target.value) || 0 })}
                                                                className="w-full h-1.5 bg-mist rounded-full appearance-none cursor-pointer accent-gold" />
                                                            <span className="text-[9px] font-mono text-ink/50">{Math.round(mItem.weight || 0)}%</span>
                                                        </div>
                                                        <div className="flex-1">
                                                            <span className="text-[9px] text-ink/50 uppercase tracking-wider block mb-0.5">Score</span>
                                                            <input type="range" min="0" max="100" step={1} value={Math.round(mScore)}
                                                                onChange={e => updateItem(mItem.id, { progress: parseFloat(e.target.value) || 0 })}
                                                                className="w-full h-1.5 bg-mist rounded-full appearance-none cursor-pointer accent-sage" />
                                                            <span className="text-[9px] font-mono text-ink/50">{Math.round(mScore)}%</span>
                                                        </div>
                                                    </div>
                                                    <button onClick={(e) => handleDelete(e, mItem.id)} className="absolute top-2 right-2 p-1.5 bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded-lg transition text-ink/50 hover:text-red-400 z-10" title="Delete">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </Card>
                                            )
                                        })}
                                    </div>
                                    {catMonths.length === 0 && !addingGoal && (
                                        <p className="text-xs text-ink/40 italic">No goals yet. Click + to add one.</p>
                                    )}
                                </div>
                            </Card>
                        )
                    })}
                </div>
            </div>

            {/* Month Reflection */}
            <div>
                <div className="flex items-center space-x-2 mb-4">
                    <BookOpen className="w-5 h-5 text-gold" />
                    <h2 className="text-2xl font-display font-bold text-ink">{monthLabel} Reflection</h2>
                </div>
                <Card className="p-6">
                    <textarea value={reflectionText}
                        onChange={(e) => { setReflectionText(e.target.value); saveReflection(e.target.value) }}
                        placeholder={`Reflect on ${monthLabel} so far... What's working? What needs to change?`}
                        className="w-full h-48 bg-black/20 border border-white/10 rounded-xl p-5 text-sm text-ink resize-none focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/30 placeholder:text-ink/30 transition-all" />
                    <p className="text-[10px] text-ink/40 mt-2">Auto-saves as you type</p>
                </Card>
            </div>

            {/* Weeks Section */}
            <div>
                <h2 className="text-3xl font-display font-bold text-ink mb-6">Weeks</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {weekGroups.map(({ title, items: wItems, avgScore, dateLabel }) => {
                        return (
                            <Card key={title} className="p-5 transition-colors group hover:border-gold cursor-pointer"
                                onClick={() => router.push(`/year/${quarterLabel}/${monthLabel}/${title.replace(/\s+/g, '')}`)}>
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <p className="text-sm font-bold uppercase tracking-widest bg-gradient-to-r from-gold to-gold-glow bg-clip-text text-transparent">{title}</p>
                                        {dateLabel && <p className="text-[10px] text-ink/40 mt-0.5">{dateLabel}</p>}
                                    </div>
                                </div>
                                <div className="flex items-end justify-between">
                                    <ProgressRing progress={avgScore} size={48} />
                                    <div className="text-right">
                                        <p className="text-xl font-mono font-bold">{Math.round(avgScore)}%</p>
                                        <p className="text-[10px] text-ink/40">{wItems.length} active goals</p>
                                    </div>
                                </div>
                            </Card>
                        )
                    })}
                    {weekGroups.length === 0 && (
                        <p className="text-sm text-ink/50 italic">Weeks will appear once goals are created.</p>
                    )}
                </div>
            </div>
        </div>
    )
}
