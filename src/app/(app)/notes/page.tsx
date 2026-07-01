'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Card } from '@/components/ui/Card'

const RichNoteModal = dynamic(() => import('@/components/items/RichNoteModal').then(mod => mod.RichNoteModal), { ssr: false })
import { BookOpen, Plus, Download, FileText } from 'lucide-react'
import Link from 'next/link'

export default function NotesPage() {
  const [notes, setNotes] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingNote, setEditingNote] = useState<any>(null)

  const fetchNotes = () => {
    fetch('/api/notes')
      .then(r => r.json())
      .then(data => {
        setNotes(data.notes || [])
      })
  }

  useEffect(() => {
    fetchNotes()
  }, [])

  const handleEdit = (note: any) => {
    setEditingNote(note)
    setShowModal(true)
  }

  const handleClose = () => {
    setShowModal(false)
    setEditingNote(null)
  }

  const handleDownload = (note: any) => {
    const blob = new Blob([note.content], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${note.title || 'note'}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-display font-bold text-ink">Notes & Brain Dumps</h1>
          <p className="text-xs text-ink/50 mt-1">Rich text notes with PDF export</p>
        </div>
        <button
          onClick={() => { setEditingNote(null); setShowModal(true) }}
          className="px-4 py-2 bg-ink text-surface rounded hover:bg-ink/90 font-medium flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Note</span>
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-mist rounded-2xl">
          <BookOpen className="w-12 h-12 text-ink/20 mx-auto mb-3" />
          <p className="text-ink/60">No notes yet. Create your first note to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map(note => (
            <Card key={note.id} className="hover:border-gold transition-colors flex flex-col">
              <div className="flex-1">
                <h3 className="font-bold text-ink mb-2">{note.title}</h3>
                <div
                  className="text-sm text-ink/70 line-clamp-3 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: note.content }}
                />
                <div className="flex items-center space-x-2 mt-3">
                  <span className="text-[10px] text-ink/40 font-mono">
                    {new Date(note.createdAt).toLocaleDateString()}
                  </span>
                  {note.itemId && (
                    <Link
                      href={`/day/${new Date(note.itemId).toISOString().split('T')[0]}`}
                      className="text-[10px] text-gold hover:underline"
                    >
                      View Day
                    </Link>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2 mt-4 pt-3 border-t border-mist">
                <button
                  onClick={() => handleEdit(note)}
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-ink/70 hover:text-ink border border-mist rounded hover:border-gold transition"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDownload(note)}
                  className="px-3 py-1.5 text-xs font-medium text-ink/70 hover:text-ink border border-mist rounded hover:border-gold transition flex items-center space-x-1"
                >
                  <Download className="w-3 h-3" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showModal && (
        <RichNoteModal
          onClose={handleClose}
          onSaved={fetchNotes}
          note={editingNote}
        />
      )}
    </div>
  )
}