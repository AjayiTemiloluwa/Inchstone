'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface NoteModalProps {
  onClose: () => void
  onSaved: () => void
}

export function NoteModal({ onClose, onSaved }: NoteModalProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), content: content.trim() }),
      })
      if (res.ok) {
        onSaved()
        onClose()
      } else {
        setError('Failed to save note. Please try again.')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm p-4">
      <div className="bg-paper w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-mist">
          <h3 className="font-bold text-ink">New Note</h3>
          <button onClick={onClose} className="p-1 hover:bg-mist rounded-full transition-colors">
            <X className="w-5 h-5 text-ink/60" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-ink/70 mb-1 block">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full rounded-lg border border-mist p-2.5 text-sm bg-surface"
              placeholder="Note title..."
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-bold text-ink/70 mb-1 block">Content</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              className="w-full rounded-lg border border-mist p-2.5 text-sm bg-surface h-40 resize-none"
              placeholder="Write your thoughts..."
            />
          </div>
          {error && (
            <p className="text-xs text-coral">{error}</p>
          )}
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-ink/70 hover:text-ink transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim() || !content.trim()}
              className="px-4 py-2 text-sm bg-ink text-surface rounded-lg font-medium hover:bg-ink/90 transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Note'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
