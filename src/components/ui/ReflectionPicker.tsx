'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'

export interface SavedReflection {
  id: string
  itemId: string | null
  timePeriod: string
  periodKey: string
  content: string
  createdAt: string
  updatedAt: string
  item: { id: string; title: string; layer: number } | null
}

interface ReflectionPickerProps {
  timePeriod: 'day' | 'week' | 'month' | 'quarter' | 'year'
  periodKey: string
  itemId?: string | null
  onSelect: (content: string) => void
  onSaved?: (reflection: SavedReflection) => void
  className?: string
}

export function ReflectionPicker({
  timePeriod,
  periodKey,
  itemId,
  onSelect,
  onSaved,
  className = '',
}: ReflectionPickerProps) {
  const [reflections, setReflections] = useState<SavedReflection[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [deleteTimer, setDeleteTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  const fetchReflections = useCallback(async () => {
    setLoading(true)
    try {
      const url = new URL('/api/reflections', window.location.origin)
      url.searchParams.set('timePeriod', timePeriod)
      url.searchParams.set('periodKey', periodKey)
      const res = await fetch(url.toString())
      if (!res.ok) return
      const data = await res.json()
      setReflections(data.reflections || [])
    } catch (e) {
      console.error('Failed to fetch reflections', e)
    } finally {
      setLoading(false)
    }
  }, [timePeriod, periodKey])

  useEffect(() => {
    fetchReflections()
  }, [fetchReflections])

  const handleSelect = (content: string) => {
    onSelect(content)
  }

  const handleSaveNew = async () => {
    const content = newContent.trim()
    if (!content || !itemId) return
    setCreating(true)
    try {
      const res = await fetch('/api/reflections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId,
          timePeriod,
          periodKey,
          content,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        console.error('Failed to save reflection template:', data.error)
        return
      }
      const data = await res.json()
      setNewContent('')
      setCreating(false)
      setReflections(prev => [data.reflection, ...prev])
      onSaved?.(data.reflection)
    } catch (e) {
      console.error('Failed to save reflection template', e)
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (deleteTimer) clearTimeout(deleteTimer)
    setReflections(prev => prev.filter(r => r.id !== id))
    try {
      const res = await fetch(`/api/reflections/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        await fetchReflections()
      }
    } catch {
      await fetchReflections()
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-[10px] text-ink/40 ${className}`}>
        <span className="text-ink/20 animate-pulse">●</span>
        <span className="text-ink/35">Loading saved reflections…</span>
      </div>
    )
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink/40">
          Saved reflections
        </span>
        {creating ? (
          <div className="flex items-center gap-2">
            <textarea
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder="New reflection template…"
              className="w-48 h-8 bg-black/20 border border-white/10 rounded-lg p-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-gold/30 resize-none"
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleSaveNew()
                }
              }}
            />
            <button
              onClick={handleSaveNew}
              disabled={!newContent.trim()}
              className="px-2 py-1.5 text-[10px] font-medium bg-gold/10 text-gold rounded border border-gold/30 hover:bg-gold/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Save
            </button>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="text-[10px] font-medium text-gold hover:text-gold/80 transition underline offset-dotted"
          >
            <Plus className="w-3 h-3 shrink-0" /> Add new
          </button>
        )}
      </div>

      {reflections.length === 0 && !creating && (
        <p className="text-[10px] text-ink/40 italic">No saved reflections yet. Add one to reuse it later.</p>
      )}

      <div className="space-y-1">
        {reflections.map((r) => (
          <div
            key={r.id}
            onClick={() => handleSelect(r.content)}
            className="flex items-center justify-between gap-2 p-2 rounded-lg border border-white/5 bg-black/10 hover:bg-white/5 hover:border-gold/30 transition cursor-pointer text-left group"
          >
            <span className="text-xs text-ink break-words leading-snug flex-1">{r.content}</span>
            <div className="flex items-center gap-1 shrink-0">
              <span
                className="text-[9px] font-mono text-ink/30"
                title={new Date(r.updatedAt).toLocaleString()}
              >
                {new Date(r.updatedAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); void handleDelete(r.id) }}
                className="p-1 opacity-0 group-hover:opacity-100 hover:bg-ember/15 rounded transition text-ink/30 hover:text-[#cf8f78]"
                title="Delete template"
              >
                <span className="w-3 h-3">✕</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
