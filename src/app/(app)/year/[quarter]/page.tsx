'use client'

import { useEffect, useState, useCallback } from 'react'
import { useHierarchyStore, Item } from '@/store/hierarchyStore'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useRouter, useParams } from 'next/navigation'
import { ChevronRight, Plus, X, Trash2, BookOpen } from 'lucide-react'
import { format, addMonths } from 'date-fns'

export default function YearQuarterPage() {
    const router = useRouter()
    const params = useParams()
    const quarterLabel = params.quarter as string

    const { items, completionMap, setItems, updateItem, getFlatItems } = useHierarchyStore()
    const [loading, setLoading] = useState(true)
    const [reflectionText, setReflectionText] = useState('')
    const [reflectionTimer, setReflectionTimer] = useState<NodeJS.Timeout | null>(null)

    const quarterMonthNames: Record<string, string[]> = {
        Q1: ['January', 'February', 'March'],
        Q2: ['April', 'May', 'June'],
        Q3: ['July', 'August', 'September'],
        Q4: ['October', 'November', 'December'],
    }

    useEffect(() => {
        fetch('/api/items').then(r => r.json()).then(data => {
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
        }).finally(() => setLoading(false))
    }, [setItems])

    const findItem = (id: string): Item | undefined => {
        const search = (nodes: Item[]): Item | undefined => {
            for (const n of nodes) { if (n.id === id) return n; if (n.children) { const f = search(n.children); if (f) return f } }
            return undefined
        }
        return search(items)
    }

    const flatItems = getFlatItems()
    const matchingQuarters = flatItems.filter(i => i.layer === 3 && i.title.includes(quarterLabel))
    const quarterItem = matchingQuarters[0]

    // Get all months that are children of this quarter
    const monthlyGoals = quarterItem?.children?.filter(c => c.layer === 4) || []
    const monthWeightSum = monthlyGoals.reduce((s, m) => s + (m.weight || 0), 0)

    // Auto-create months if none exist
    const ensureMonths = useCallback(async () => {
        if (!quarterItem || monthlyGoals.length > 0) return
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
        // Refresh
        const res = await fetch('/api/items')
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
    }, [quarterItem, monthlyGoals.length, quarterLabel, setItems])

    useEffect(() => {
        if (!loading && quarterItem && monthlyGoals.length === 0) {
            ensureMonths()
        }
    }, [loading, quarterItem, monthlyGoals.length, ensureMonths])

    // Initialize reflection
    useEffect(() => {
        if (quarterItem?.reflection && reflectionText === '') {
            setReflectionText(quarterItem.reflection)
        }
    }, [quarterItem, reflectionText])

    const saveReflection = useCallback((text: string) => {
        if (!quarterItem) return
        if (reflectionTimer) clearTimeout(reflectionTimer)
        const timer = setTimeout(() => { updateItem(quarterItem.id, { reflection: text }) }, 800)
        setReflectionTimer(timer)
    }, [quarterItem, updateItem, reflectionTimer])

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        if (!confirm('Are you sure you want to delete this?')) return
        try {
            const res = await fetch(`/api/items/${id}`, { method: 'DELETE' })
            if (!res.ok) { alert('Failed to delete item') }
            else {
                if (id === quarterItem?.id) { router.push('/year') }
                else {
                    fetch('/api/items').then(r => r.json()).then(data => {
                        if (data.items) {
                            const itemMap = new Map()
                            data.items.forEach((item: any) => itemMap.set(item.id, { ...item, children: [], tasks: item.tasks || [] }))
                            const tree: any[] = []
                            data.items.forEach((item: any) => {
                                if (item.parentId) { const parent = itemMap.get(item.parentId); if (parent) parent.children.push(itemMap.get(item.id)) }
                                else { tree.push(itemMap.get(item.id)) }
                            })
                            setItems(tree)
                            const remaining = data.items.filter((i: any) => i.parentId === quarterItem?.id)
                            if (remaining.length > 0) { const eq = Math.round((100 / remaining.length) * 10) / 10; remaining.forEach((m: any) => updateItem(m.id, { weight: eq })) }
                        }
                    })
                }
            }
        } catch (e) { console.error(e) }
    }

    if (loading) return <div className="flex justify-center items-center h-full"><span className="text-ink/60">Loading...</span></div>
    if (!quarterItem) return <div className="p-6 text-ink/60">Quarter not found.</div>

    const qScore = completionMap[quarterItem.id] || 0

    return (
        <div className="space-y-8 max-w-full pb-12">
            {/* Breadcrumb */}
            <div className="flex items-center space-x-2 text-sm text-ink/50">
                <button onClick={() => router.push('/year')} className="hover:text-gold transition">Year</button>
                <ChevronRight className="w-3 h-3" />
                <span className="text-ink font-bold">{quarterLabel}</span>
            </div>

            {/* Quarter Header */}
            <div className="bg-surface border border-mist rounded-2xl p-8 relative">
                <button onClick={(e) => handleDelete(e, quarterItem.id)} className="absolute top-4 right-4 p-2 text-ink/30 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Delete Quarter">
                    <Trash2 className="w-5 h-5" />
                </button>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-display font-bold text-ink">{quarterItem.title}</h1>
                        <p className="text-sm text-ink/50 mt-2 font-mono">
                            {quarterItem.startDate && format(new Date(quarterItem.startDate), 'MMM d')} – {quarterItem.endDate && format(new Date(quarterItem.endDate), 'MMM d, yyyy')}
                        </p>
                    </div>
                    <ProgressRing progress={qScore} size={72} />
                </div>
            </div>

            {/* Months Section */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-display font-bold text-ink">Months</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {monthlyGoals.map((month, idx) => {
                        const mScore = completionMap[month.id] || 0
                        const monthLabel = month.startDate ? format(new Date(month.startDate), 'MMMM') : `Month ${idx + 1}`
                        return (
                            <Card key={month.id} className="p-5 hover:border-gold transition-colors cursor-pointer group relative" onClick={() => router.push(`/month/${month.id}`)}>
                                <button onClick={(e) => handleDelete(e, month.id)} className="absolute top-2 right-2 p-1.5 bg-paper/80 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded-lg transition text-ink/30 hover:text-red-500 z-10" title="Delete Month">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                <div className="flex items-center justify-between mb-3 pr-6">
                                    <div>
                                        <p className="text-sm font-bold text-ink">{monthLabel}</p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-ink/30 group-hover:text-gold transition" />
                                </div>
                                <div className="flex items-center justify-between mb-2">
                                    <ProgressRing progress={mScore} size={40} />
                                    <span className="text-lg font-mono font-bold">{Math.round(mScore)}%</span>
                                </div>
                                <div className="flex items-center gap-4" onClick={e => e.stopPropagation()}>
                                    <div className="flex-1">
                                        <span className="text-[9px] text-ink/50 uppercase tracking-wider block mb-0.5">Weight</span>
                                        <input type="range" min="0" max="100" step={1} value={month.weight || 0}
                                            onChange={e => updateItem(month.id, { weight: parseFloat(e.target.value) || 0 })}
                                            className="w-full h-1.5 bg-mist rounded-full appearance-none cursor-pointer accent-gold" />
                                        <span className="text-[9px] font-mono text-ink/50">{Math.round(month.weight || 0)}%</span>
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-[9px] text-ink/50 uppercase tracking-wider block mb-0.5">Score</span>
                                        <input type="range" min="0" max="100" step={1} value={Math.round(mScore)}
                                            onChange={e => updateItem(month.id, { progress: parseFloat(e.target.value) || 0 })}
                                            className="w-full h-1.5 bg-mist rounded-full appearance-none cursor-pointer accent-sage" />
                                        <span className="text-[9px] font-mono text-ink/50">{Math.round(mScore)}%</span>
                                    </div>
                                </div>
                            </Card>
                        )
                    })}
                </div>
                {monthlyGoals.length > 0 && (
                    <div className="flex justify-end mt-2">
                        <span className={`text-[10px] font-mono ${Math.round(monthWeightSum) === 100 ? 'text-sage' : 'text-coral'}`}>
                            Total: {Math.round(monthWeightSum)}%
                        </span>
                    </div>
                )}
            </div>

            {/* Reflection Section */}
            <div>
                <div className="flex items-center space-x-2 mb-4">
                    <BookOpen className="w-5 h-5 text-gold" />
                    <h2 className="text-2xl font-display font-bold text-ink">Quarter Reflection</h2>
                </div>
                <Card className="p-5">
                    <textarea value={reflectionText}
                        onChange={(e) => { setReflectionText(e.target.value); saveReflection(e.target.value) }}
                        placeholder="Reflect on this quarter..."
                        className="w-full h-48 bg-paper border border-mist rounded-lg p-4 text-sm text-ink resize-none focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-ink/30" />
                    <p className="text-[10px] text-ink/40 mt-2">Auto-saves as you type</p>
                </Card>
            </div>
        </div>
    )
}