'use client'

import { useState, useEffect } from 'react'
import { X, CheckCircle, Circle } from 'lucide-react'
import { useHierarchyStore } from '@/store/hierarchyStore'

interface DayModalProps {
    deedId: string
    onClose: () => void
}

export function DayModal({ deedId, onClose }: DayModalProps) {
    const { items, completionMap, updateItem } = useHierarchyStore()
    const [deed, setDeed] = useState<any>(null)
    const [note, setNote] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        // Find the deed in the tree
        const findDeed = (nodes: any[]): any => {
            for (const node of nodes) {
                if (node.id === deedId) return node
                if (node.children) {
                    const found = findDeed(node.children)
                    if (found) return found
                }
            }
            return null
        }
        const found = findDeed(items)
        setDeed(found)
    }, [deedId, items])

    if (!deed) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm p-4">
                <div className="bg-paper w-full max-w-md rounded-2xl shadow-2xl p-6">
                    <p className="text-ink/60 text-center">Deed not found.</p>
                    <button onClick={onClose} className="mt-4 w-full py-2 bg-ink text-surface rounded-lg">Close</button>
                </div>
            </div>
        )
    }

    const isCompleted = (completionMap[deedId] || 0) >= 100

    const handleToggle = () => {
        updateItem(deedId, { completed: !isCompleted, progress: isCompleted ? 0 : 100 })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm p-4">
            <div className="bg-paper w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-mist">
                    <h3 className="font-bold text-ink">Daily Deed</h3>
                    <button onClick={onClose} className="p-1 hover:bg-mist rounded-full transition-colors">
                        <X className="w-5 h-5 text-ink/60" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="flex items-start space-x-3">
                        <button onClick={handleToggle} className="mt-0.5 shrink-0">
                            {isCompleted ? (
                                <CheckCircle className="w-6 h-6 text-sage" />
                            ) : (
                                <Circle className="w-6 h-6 text-ink/30 hover:text-gold transition-colors" />
                            )}
                        </button>
                        <div>
                            <p className={`font-semibold ${isCompleted ? 'line-through text-ink/50' : 'text-ink'}`}>
                                {deed.title}
                            </p>
                            {deed.category && (
                                <span className="inline-block mt-1 px-2 py-0.5 bg-mist rounded text-[10px] font-mono text-ink/70">
                                    {deed.category}
                                </span>
                            )}
                            {deed.startDate && (
                                <p className="text-xs text-ink/50 mt-2">
                                    {new Date(deed.startDate).toLocaleDateString('en-US', {
                                        weekday: 'long', month: 'long', day: 'numeric'
                                    })}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Quick note area */}
                    <div>
                        <label className="text-xs font-bold text-ink/70 mb-1 block">Quick Note</label>
                        <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            className="w-full rounded-lg border border-mist p-2.5 text-sm bg-surface h-24 resize-none"
                            placeholder="Add a note about this deed..."
                        />
                    </div>

                    <div className="flex justify-end space-x-3 pt-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-ink/70 hover:text-ink transition"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}