'use client'

import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { useHierarchyStore, Item } from '@/stores/hierarchyStore'
import { Card } from '@/components/ui/Card'

type CategoryEditModalProps = {
    categoryId: string | null
    onClose: () => void
}

export function CategoryEditModal({ categoryId, onClose }: CategoryEditModalProps) {
    const { getFlatItems, updateItem, updateItemScoreMode } = useHierarchyStore()
    const flatItems = getFlatItems()
    const category = categoryId ? flatItems.find(i => i.id === categoryId) : null

    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [theme, setTheme] = useState('')
    const [focusQuestion, setFocusQuestion] = useState('')
    const [anchorScripture, setAnchorScripture] = useState('')
    const [reflection, setReflection] = useState('')
    const [weight, setWeight] = useState(0)
    const [progress, setProgress] = useState(0)
    const [scoreMode, setScoreMode] = useState<'auto' | 'manual'>('auto')

    useEffect(() => {
        if (category) {
            setTitle(category.title || '')
            setDescription(category.description || '')
            setTheme(category.theme || '')
            setFocusQuestion(category.focusQuestion || '')
            setAnchorScripture(category.anchorScripture || '')
            setReflection(category.reflection || '')
            setWeight(category.weight || 0)
            setProgress(category.progress || 0)
            setScoreMode(category.scoreMode as 'auto' | 'manual' || 'auto')
        }
    }, [category])

    const handleSave = useCallback(() => {
        if (!categoryId || !title.trim()) return
        updateItem(categoryId, {
            title: title.trim(),
            description: description.trim() || null,
            theme: theme.trim() || null,
            focusQuestion: focusQuestion.trim() || null,
            anchorScripture: anchorScripture.trim() || null,
            reflection: reflection.trim() || null,
            weight,
            progress,
        })
        if (scoreMode === 'manual') {
            updateItemScoreMode(categoryId, 'manual', progress)
        }
        onClose()
    }, [categoryId, title, description, theme, focusQuestion, anchorScripture, reflection, weight, progress, scoreMode, updateItem, updateItemScoreMode, onClose])

    if (!category) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 pb-20 space-y-5 animate-fadeIn glass rounded-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-display font-bold text-ink">Edit Category</h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-mist rounded-lg transition text-ink/50 hover:text-ink">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Title */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-ink/50">Title</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                        className="w-full px-4 py-2.5 text-sm bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-ink/30" />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-ink/50">Description</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                        className="w-full px-4 py-2.5 text-sm bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-ink/30 resize-none" />
                </div>

                {/* Theme */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-ink/50">Theme</label>
                    <input type="text" value={theme} onChange={e => setTheme(e.target.value)}
                        className="w-full px-4 py-2.5 text-sm bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-ink/30" />
                </div>

                {/* Focus Question */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-ink/50">Focus Question</label>
                    <input type="text" value={focusQuestion} onChange={e => setFocusQuestion(e.target.value)}
                        className="w-full px-4 py-2.5 text-sm bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-ink/30" />
                </div>

                {/* Anchor Scripture */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-ink/50">Anchor Scripture</label>
                    <input type="text" value={anchorScripture} onChange={e => setAnchorScripture(e.target.value)}
                        className="w-full px-4 py-2.5 text-sm bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-ink/30" />
                </div>

                {/* Weight */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-ink/50">Weight</label>
                        <span className="text-xs font-mono text-gold">{Math.round(weight)}%</span>
                    </div>
                    <input type="range" min={0} max={100} step={1} value={weight}
                        onChange={e => setWeight(parseFloat(e.target.value))}
                        className="w-full h-2 bg-mist rounded-full appearance-none cursor-pointer accent-gold" />
                </div>

                {/* Score Mode + Progress */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-ink/50">Score</label>
                        <span className="text-xs font-mono text-sage">{Math.round(progress)}%</span>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={() => setScoreMode(scoreMode === 'auto' ? 'manual' : 'auto')}
                            className={`px-3 py-1 text-[10px] font-bold uppercase rounded-lg border transition ${scoreMode === 'auto' ? 'bg-gold/20 text-gold border-gold/40' : 'bg-white/10 text-ink/50 border-white/20'}`}
                        >
                            {scoreMode === 'auto' ? 'Auto' : 'Manual'}
                        </button>
                        {scoreMode === 'manual' && (
                            <input type="number" min={0} max={100} value={Math.round(progress)}
                                onChange={e => setProgress(parseFloat(e.target.value) || 0)}
                                className="w-16 px-2 py-1 text-xs font-mono bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30 text-center" />
                        )}
                    </div>
                    <input type="range" min={0} max={100} step={1} value={Math.round(progress)}
                        onChange={e => setProgress(parseFloat(e.target.value))}
                        className="w-full h-2 bg-mist rounded-full appearance-none cursor-pointer accent-sage" />
                </div>

                {/* Reflection */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-ink/50">Reflection</label>
                    <textarea value={reflection} onChange={e => setReflection(e.target.value)} rows={4}
                        className="w-full px-4 py-2.5 text-sm bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-ink/30 resize-none" />
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-3 pt-2">
                    <button onClick={handleSave}
                        className="flex-1 px-4 py-3 bg-gold text-paper text-sm font-bold rounded-xl hover:bg-gold-glow transition-all active:scale-95 shadow-lg shadow-gold/20">
                        Save Changes
                    </button>
                    <button onClick={onClose}
                        className="px-4 py-3 text-sm text-ink/50 hover:text-ink hover:bg-white/5 rounded-xl transition">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    )
}