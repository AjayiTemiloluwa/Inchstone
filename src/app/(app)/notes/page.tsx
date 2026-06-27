'use client'

import { Card } from '@/components/ui/Card'
import { NoteModal } from '@/components/items/NoteModal'
import { useState, useEffect } from 'react'

export default function NotesPage() {
  const [notes, setNotes] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)

  const fetchNotes = () => {
    fetch('/api/notes').then(r => r.json()).then(data => setNotes(data.notes || []))
  }

  useEffect(() => {
    fetchNotes()
  }, [])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-display font-bold text-ink">Notes & Brain Dumps</h1>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-ink text-surface rounded hover:bg-ink/90 font-medium"
        >
          New Note
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {notes.length === 0 ? (
          <p className="text-ink/60 p-4 border border-dashed border-mist rounded text-center col-span-2">No notes yet.</p>
        ) : (
          notes.map(note => (
            <Card key={note.id} className="hover:border-gold cursor-pointer transition-colors">
              <h3 className="font-bold text-ink mb-2">{note.title}</h3>
              <p className="text-sm text-ink/70 line-clamp-3">{note.content}</p>
              <p className="text-xs text-ink/40 mt-4">{new Date(note.createdAt).toLocaleDateString()}</p>
            </Card>
          ))
        )}
      </div>

      {showModal && (
        <NoteModal
          onClose={() => setShowModal(false)}
          onSaved={fetchNotes}
        />
      )}
    </div>
  )
}
