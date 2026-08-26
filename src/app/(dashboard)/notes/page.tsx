'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Card } from '@/components/ui/Card'

const RichNoteModal = dynamic(() => import('@/components/ui/RichNoteModal').then(mod => mod.RichNoteModal), { ssr: false })
import { BookOpen, Plus, Download } from 'lucide-react'
import Link from 'next/link'
import { Scramble } from '@/components/ui/motion'

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
    <div className="max-w-[720px] mx-auto space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-parchment"><Scramble text="Notes" mono={false} /></h1>
          <p className="mt-1 font-mono text-xs text-parchment/50">Rich text notes with PDF export</p>
        </div>
        <button
          onClick={() => { setEditingNote(null); setShowModal(true) }}
          className="rounded-md bg-gold px-4 py-2.5 text-sm font-semibold text-ink hover:bg-[#cbaa6f] transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" strokeWidth={1.5} />
          <span>New Note</span>
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="rounded-[8px] border border-dashed border-gold-dim/30 py-16 text-center">
          <BookOpen className="mx-auto mb-3 h-10 w-10 text-gold-dim" strokeWidth={1.5} />
          <p className="text-sm text-parchment/60">
            Nothing written yet — a single honest sentence today is enough. Start with your first note.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {notes.map(note => (
            <Card key={note.id} className="hover:border-gold/40 transition-colors flex flex-col">
              <div className="flex-1">
                <h3 className="font-semibold text-parchment mb-2">{note.title}</h3>
                <div
                  className="text-sm text-parchment/70 line-clamp-3 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: note.content }}
                />
                <div className="flex items-center gap-2 mt-3">
                  <span className="font-mono text-[11px] text-parchment/40">
                    {new Date(note.createdAt).toLocaleDateString()}
                  </span>
                  {note.itemId && (
                    <Link
                      href={`/day/${new Date(note.itemId).toISOString().split('T')[0]}`}
                      className="font-mono text-[11px] text-gold hover:text-gold/80"
                    >
                      View Day
                    </Link>
                  )}
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 border-t border-gold-dim/15 pt-3">
                <button
                  onClick={() => handleEdit(note)}
                  className="flex-1 rounded-md border hairline px-3 py-1.5 text-xs text-parchment/80 hover:border-gold transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDownload(note)}
                  aria-label="Download note"
                  className="rounded-md border hairline px-3 py-1.5 text-parchment/80 hover:border-gold transition-colors flex items-center gap-1"
                >
                  <Download className="w-3 h-3" strokeWidth={1.5} />
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
