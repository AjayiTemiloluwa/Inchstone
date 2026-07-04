'use client'

import { useEffect, useState, useCallback } from 'react'
import { useHierarchyStore, Item } from '@/store/hierarchyStore'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useRouter, useParams } from 'next/navigation'
import { ChevronRight, Plus, X, Trash2, BookOpen, Download } from 'lucide-react'
import { format, addMonths } from 'date-fns'
import { useToast } from '@/components/ui/ToastProvider'

export default function YearQuarterPage() {
    const router = useRouter()
    const params = useParams()
    const quarterLabel = params.quarter as string

    const { items, completionMap, setItems, updateItem, getFlatItems } = useHierarchyStore()
    const { showToast, confirm } = useToast()
    const [loading, setLoading] = useState(true)

    const [addingGoal, setAddingGoal] = useState<string | null>(null)
    const [newGoalTitle, setNewGoalTitle] = useState('')

    const [reflectionText, setReflectionText] = useState('')
    const [reflectionTimer, setReflectionTimer] = useState<NodeJS.Timeout | null>(null)

    const quarterMonthNames: Record<string, string[]> = {
        Q1: ['January', 'February', 'March'],
        Q2: ['April', 'May', 'June'],
        Q3: ['July', 'August', 'September'],
        Q4: ['October', 'November', 'December'],
    }

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

    // Auto-create months if none exist for each quarter
    const ensureMonths = useCallback(async () => {
        let changed = false
        for (const quarterItem of matchingQuarters) {
            const monthlyGoals = quarterItem.children?.filter(c => c.layer === 4) || []
            if (monthlyGoals.length === 0) {
                changed = true
                const monthNames = quarterMonthNames[quarterLabel] || ['Month 1', 'Month 2', 'Month 3']
                const qStart = new Date(quarterItem.startDate || new Date())
                const perWeight = Math.round((100 / 3) * 10) / 10

                for (let m = 0; m < 3; m++) {
                    const mStart = addMonths(qStart, m)
                    await fetch('/api/items', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ layer: 4, parentId: quarterItem.id, title: monthNames[m], weight: perWeight, startDate: mStart.toISOString(), endDate: addMonths(mStart, 1).toISOString() })
                    })
                }
            }
        }

        if (changed) {
            await fetchItems()
        }
    }, [matchingQuarters, quarterLabel, fetchItems])

    useEffect(() => {
        if (!loading && matchingQuarters.length > 0) {
            const needsMonths = matchingQuarters.some(q => (q.children?.filter(c => c.layer === 4) || []).length === 0)
            if (needsMonths) {
                ensureMonths()
            }
        }
    }, [loading, matchingQuarters, ensureMonths])

    // Reflection — use the first matching quarter's reflection field
    useEffect(() => {
        if (matchingQuarters.length > 0 && matchingQuarters[0].reflection && reflectionText === '') {
            setReflectionText(matchingQuarters[0].reflection)
        }
    }, [matchingQuarters, reflectionText])

    const saveReflection = useCallback((text: string) => {
        if (matchingQuarters.length === 0) return
        if (reflectionTimer) clearTimeout(reflectionTimer)
        const timer = setTimeout(() => {
            updateItem(matchingQuarters[0].id, { reflection: text })
        }, 800)
        setReflectionTimer(timer)
    }, [matchingQuarters, updateItem, reflectionTimer])

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

            const allGoals = [...existingGoals]
            if (goalData.success && goalData.item) {
                allGoals.push(goalData.item)
            }
            const perGoal = Math.round((100 / allGoals.length) * 10) / 10
            allGoals.forEach(g => {
                updateItem(g.id, { weight: perGoal })
            })

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
            else {
                await fetchItems()
                showToast('Item deleted', 'success')
            }
        } catch (e) { console.error(e) }
    }

    const handleDownloadReport = async () => {
        const element = document.getElementById('report-content')
        if (!element) return

        const opt = {
            margin: 0.5,
            filename: `${quarterLabel}_Report.pdf`,
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

    // Average score across all matching quarters
    const avgScore = matchingQuarters.length > 0
        ? matchingQuarters.reduce((s, q) => s + (completionMap[q.id] || 0), 0) / matchingQuarters.length
        : 0

    if (loading) return <div className="flex justify-center items-center h-full"><span className="text-ink/60">Loading...</span></div>
    if (categories.length === 0) return <div className="p-6 text-ink/60">No categories found. Seed the framework first.</div>

    // Group months by label for the months section
    const defaultMonthNames = quarterMonthNames[quarterLabel] || ['Month 1', 'Month 2', 'Month 3']
    const monthGroups = defaultMonthNames.map(label => {
        const mItems = matchingQuarters.flatMap(q => q.children?.filter(c => c.layer === 4 && c.title === label) || [])
        const avgMonthScore = mItems.length > 0 ? mItems.reduce((s, m) => s + (completionMap[m.id] || 0), 0) / mItems.length : 0
        return { label, items: mItems, avgScore: avgMonthScore }
    })

    return (
        <div className="space-y-8 max-w-full pb-12 stagger-children" id="report-content">
            {/* Breadcrumb */}
            <div className="flex items-center space-x-2 text-sm text-ink/50">
                <button onClick={() => router.push('/year')} className="hover:text-gold transition">Year</button>
                <ChevronRight className="w-3 h-3" />
                <span className="text-ink font-bold">{quarterLabel}</span>
            </div>

            {/* Quarter Aggregation Header */}
            <div className="glass-gold glow-sm rounded-3xl p-8 animate-slideUp border border-gold/20">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-display font-bold bg-gradient-to-r from-gold to-gold-glow bg-clip-text text-transparent">{quarterLabel} Overview</h1>
                        <p className="text-sm text-ink/70 mt-2 font-mono">
                            Showing all goals across your Yearly Categories for {quarterLabel}
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
                        const goalWeightSum = catQuarters.reduce((s, g) => s + (g.weight || 0), 0)

                        return (
                            <Card key={category.id} className="p-5 space-y-4">
                                {/* Category Header */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-bold text-ink">{category.title}</h3>
                                        <div className="flex items-center space-x-3">
                                            <div className="flex items-center space-x-1">
                                                <span className="text-[10px] font-bold text-ink/50 uppercase tracking-wider">Score:</span>
                                                <input type="number" min="0" max="100" value={Math.round(catScore)}
                                                    onChange={e => updateItem(category.id, { progress: parseFloat(e.target.value) || 0 })}
                                                    className="w-12 px-1 py-0.5 text-[10px] font-mono bg-white/[0.06] rounded border border-transparent hover:border-white/20 focus:bg-white/[0.1] focus:border-gold outline-none transition-colors" />
                                                <span className="text-[9px] text-ink/50">%</span>
                                            </div>
                                        </div>
                                    </div>
                                    <ProgressBar progress={catScore} colorClass="bg-sage" />
                                </div>

                                {/* Goals */}
                                <div className="space-y-3 pt-2 border-t border-mist">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold uppercase text-ink/50">Goals</span>
                                        <div className="flex items-center space-x-2">
                                            <span className={`text-[10px] font-mono ${Math.round(goalWeightSum) === 100 ? 'text-sage' : 'text-coral'}`}>
                                                Total Q-Weight: {Math.round(goalWeightSum)}%
                                            </span>
                                            <button onClick={() => setAddingGoal(addingGoal === category.id ? null : category.id)} className="p-1 hover:bg-mist rounded-lg transition text-ink/50 hover:text-gold">
                                                {addingGoal === category.id ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>
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
                                        {catQuarters.map(qItem => {
                                            const qScore = completionMap[qItem.id] || 0
                                            const parentYearlyGoal = catYearlyGoals.find(yg => yg.id === qItem.parentId)

                                            return (
                                                <Card key={qItem.id} className="p-4 hover:border-gold transition-colors group relative cursor-pointer" onClick={() => router.push(`/quarter/${qItem.id}`)}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h4 className="font-bold text-ink text-sm truncate pr-6">{parentYearlyGoal?.title}</h4>
                                                        <div className="flex items-center space-x-2">
                                                            <ProgressRing progress={qScore} size={32} />
                                                            <span className="text-base font-mono font-bold">{Math.round(qScore)}%</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4" onClick={e => e.stopPropagation()}>
                                                        <div className="flex-1">
                                                            <span className="text-[9px] text-ink/50 uppercase tracking-wider block mb-0.5">Weight (in Year)</span>
                                                            <input type="range" min="0" max="100" step={1} value={qItem.weight}
                                                                onChange={e => updateItem(qItem.id, { weight: parseFloat(e.target.value) || 0 })}
                                                                className="w-full h-1.5 bg-mist rounded-full appearance-none cursor-pointer accent-gold" />
                                                            <span className="text-[9px] font-mono text-ink/50">{Math.round(qItem.weight || 0)}%</span>
                                                        </div>
                                                        <div className="flex-1">
                                                            <span className="text-[9px] text-ink/50 uppercase tracking-wider block mb-0.5">Score</span>
                                                            <input type="range" min="0" max="100" step={1} value={Math.round(qScore)}
                                                                onChange={e => updateItem(qItem.id, { progress: parseFloat(e.target.value) || 0 })}
                                                                className="w-full h-1.5 bg-mist rounded-full appearance-none cursor-pointer accent-sage" />
                                                            <span className="text-[9px] font-mono text-ink/50">{Math.round(qScore)}%</span>
                                                        </div>
                                                    </div>
                                                    <button onClick={(e) => handleDelete(e, qItem.id)} className="absolute top-2 right-2 p-1.5 bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded-lg transition text-ink/50 hover:text-red-400 z-10" title="Delete Goal">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </Card>
                                            )
                                        })}
                                    </div>
                                    {catQuarters.length === 0 && !addingGoal && (
                                        <p className="text-xs text-ink/40 italic">No goals yet. Click + to add one.</p>
                                    )}
                                </div>
                            </Card>
                        )
                    })}
                </div>
            </div>

            {/* Quarter Reflection */}
            <div>
                <div className="flex items-center space-x-2 mb-4">
                    <BookOpen className="w-5 h-5 text-gold" />
                    <h2 className="text-2xl font-display font-bold text-ink">{quarterLabel} Reflection</h2>
                </div>
                <Card className="p-6">
                    <textarea value={reflectionText}
                        onChange={(e) => { setReflectionText(e.target.value); saveReflection(e.target.value) }}
                        placeholder={`Reflect on ${quarterLabel} so far... What's working? What needs to change?`}
                        className="w-full h-48 bg-black/20 border border-white/10 rounded-xl p-5 text-sm text-ink resize-none focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/30 placeholder:text-ink/30 transition-all" />
                    <p className="text-[10px] text-ink/40 mt-2">Auto-saves as you type</p>
                </Card>
            </div>

            {/* Months Section - below reflection */}
            <div>
                <h2 className="text-3xl font-display font-bold text-ink mb-6">Months</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {monthGroups.map(({ label, items: mItems, avgScore }) => {
                        return (
                            <Card key={label} className="p-5 transition-colors group hover:border-gold cursor-pointer"
                                onClick={() => router.push(`/year/${quarterLabel}/${label}`)}>
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <p className="text-sm font-bold uppercase tracking-widest bg-gradient-to-r from-gold to-gold-glow bg-clip-text text-transparent">{label}</p>
                                    </div>
                                </div>
                                <div className="flex items-end justify-between">
                                    <ProgressRing progress={avgScore} size={48} />
                                    <div className="text-right">
                                        <p className="text-xl font-mono font-bold">{Math.round(avgScore)}%</p>
                                        <p className="text-[10px] text-ink/40">{mItems.length} active goals</p>
                                    </div>
                                </div>
                            </Card>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}