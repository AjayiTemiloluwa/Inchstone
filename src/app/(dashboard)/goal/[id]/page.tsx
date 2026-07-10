'use client'

import { useEffect, useState, useCallback } from 'react'
import { useHierarchyStore, Item } from '@/stores/hierarchyStore'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useRouter, useParams } from 'next/navigation'
import { ChevronRight, Plus, X, Trash2, BookOpen } from 'lucide-react'
import { format } from 'date-fns'

export default function GoalPage() {
    const router = useRouter()
    const params = useParams()
    const goalId = params.id as string

    const { items, completionMap, setItems, updateItem } = useHierarchyStore()
    const [loading, setLoading] = useState(true)
    const [reflectionPopup, setReflectionPopup] = useState<string | null>(null)
    const [reflectionText, setReflectionText] = useState('')
    const [reflectionTimer, setReflectionTimer] = useState<NodeJS.Timeout | null>(null)

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

    const goalItem = findItem(goalId)
    const quarters = goalItem?.children?.filter(c => c.layer === 3) || []
    const parentCategory = goalItem?.parentId ? findItem(goalItem.parentId) : undefined
    const quarterWeightSum = quarters.reduce((s, q) => s + (q.weight || 0), 0)

    const saveReflection = useCallback((text: string) => {
        if (!reflectionPopup) return
        if (reflectionTimer) clearTimeout(reflectionTimer)
        const timer = setTimeout(() => { updateItem(reflectionPopup, { reflection: text }) }, 800)
        setReflectionTimer(timer)
    }, [reflectionPopup, updateItem, reflectionTimer])

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        if (!confirm('Are you sure you want to delete this? All nested goals will also be deleted.')) return
        try {
            const res = await fetch(`/api/items/${id}`, { method: 'DELETE' })
            if (!res.ok) { alert('Failed to delete item') }
            else {
                if (id === goalId) { router.push('/year') }
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
                            const remaining = data.items.filter((i: any) => i.parentId === goalId)
                            if (remaining.length > 0) { const eq = Math.round((100 / remaining.length) * 10) / 10; remaining.forEach((m: any) => updateItem(m.id, { weight: eq })) }
                        }
                    })
                }
            }
        } catch (e) { console.error(e) }
    }

    if (loading) return <div className="flex justify-center items-center h-full"><span className="text-ink/60">Loading...</span></div>
    if (!goalItem) return <div className="p-6 text-ink/60">Goal not found.</div>

    const gScore = completionMap[goalItem.id] || 0

    return (
        <div className="space-y-8 max-w-full pb-12">
            {/* Breadcrumb */}
            <div className="flex items-center space-x-2 text-sm text-ink/50">
                <button onClick={() => router.push('/year')} className="hover:text-gold transition">Year</button>
                <ChevronRight className="w-3 h-3" />
                {parentCategory && <><span>{parentCategory.title}</span><ChevronRight className="w-3 h-3" /></>}
                <span className="text-ink font-bold">{goalItem.title}</span>
            </div>

            {/* Goal Header */}
            <div className="bg-surface border border-mist rounded-2xl p-8 relative">
                <button onClick={(e) => handleDelete(e, goalItem.id)} className="absolute top-4 right-4 p-2 text-ink/30 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Delete Goal">
                    <Trash2 className="w-5 h-5" />
                </button>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-display font-bold text-ink">{goalItem.title}</h1>
                        {goalItem.theme && <p className="text-gold font-serif italic mt-1">"{goalItem.theme}"</p>}
                        <p className="text-sm text-ink/50 mt-2 font-mono">
                            {goalItem.startDate && format(new Date(goalItem.startDate), 'MMM d')} – {goalItem.endDate && format(new Date(goalItem.endDate), 'MMM d, yyyy')}
                        </p>
                    </div>
                    <ProgressRing progress={gScore} size={72} />
                </div>
            </div>

            {/* Quarters Section */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-display font-bold text-ink">Quarters</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {quarters.map((quarter, idx) => {
                        const qScore = completionMap[quarter.id] || 0
                        const qLabel = quarter.title || `Q${idx + 1}`
                        return (
                            <Card key={quarter.id} className="p-5 hover:border-gold transition-colors cursor-pointer group relative" onClick={() => router.push(`/quarter/${quarter.id}`)}>
                                <button onClick={(e) => handleDelete(e, quarter.id)} className="absolute top-2 right-2 p-1.5 bg-paper/80 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded-lg transition text-ink/30 hover:text-red-500 z-10" title="Delete Quarter">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                <div className="flex items-center justify-between mb-3 pr-6">
                                    <div>
                                        <p className="text-sm font-bold text-ink">{qLabel}</p>
                                        <p className="text-[10px] text-ink/40 font-mono mt-0.5">
                                            {quarter.startDate && format(new Date(quarter.startDate), 'MMM d')} – {quarter.endDate && format(new Date(quarter.endDate), 'MMM d')}
                                        </p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-ink/30 group-hover:text-gold transition" />
                                </div>
                                <div className="flex items-center justify-between mb-2">
                                    <ProgressRing progress={qScore} size={40} />
                                    <span className="text-lg font-mono font-bold">{Math.round(qScore)}%</span>
                                </div>
                                <div onClick={e => e.stopPropagation()}>
                                    <span className="text-[9px] text-ink/50 uppercase tracking-wider block mb-0.5">Weight</span>
                                    <input type="range" min="0" max="100" step={1} value={quarter.weight || 0}
                                        onChange={e => updateItem(quarter.id, { weight: parseFloat(e.target.value) || 0 })}
                                        className="w-full h-1.5 bg-mist rounded-full appearance-none cursor-pointer accent-gold" />
                                    <span className="text-[9px] font-mono text-ink/50">{Math.round(quarter.weight || 0)}%</span>
                                </div>
                            </Card>
                        )
                    })}
                </div>
                {quarters.length > 0 && (
                    <div className="flex justify-end mt-2">
                        <span className={`text-[10px] font-mono ${Math.round(quarterWeightSum) === 100 ? 'text-sage' : 'text-coral'}`}>
                            Total: {Math.round(quarterWeightSum)}%
                        </span>
                    </div>
                )}
                {quarters.length === 0 && <p className="text-sm text-ink/40 italic">No quarters found for this goal.</p>}
            </div>

            {/* Reflection Popup */}
            {reflectionPopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setReflectionPopup(null)}>
                    <div className="bg-surface rounded-2xl border border-mist shadow-xl p-5 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-2"><BookOpen className="w-4 h-4 text-gold" /><h3 className="font-bold text-ink text-sm">Reflection</h3></div>
                            <button onClick={() => setReflectionPopup(null)} className="p-1 hover:bg-mist rounded-lg transition text-ink/30 hover:text-ink"><X className="w-4 h-4" /></button>
                        </div>
                        <textarea value={reflectionText} onChange={(e) => { setReflectionText(e.target.value); saveReflection(e.target.value) }}
                            placeholder="Write your reflection..." className="w-full h-32 bg-paper border border-mist rounded-lg p-3 text-sm text-ink resize-none focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-ink/30" />
                        <p className="text-[10px] text-ink/40 mt-1">Auto-saves as you type</p>
                    </div>
                </div>
            )}
        </div>
    )
}
