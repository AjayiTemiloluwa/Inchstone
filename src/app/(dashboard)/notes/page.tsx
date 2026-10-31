'use client'

import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Plus, Download, Pencil, Trash2, Search, ArrowUpRight } from 'lucide-react'
import { Loader } from '@/components/ui/Loader'
import { Scramble } from '@/components/ui/motion'
import { useToast } from '@/components/ui/ToastProvider'
import {
  Page, PageHeader, Section, Panel, EmptyState, Button, RowActions, Segmented, inputClass, cx,
} from '@/components/ds'

const RichNoteModal = dynamic(() => import('@/components/ui/RichNoteModal').then(mod => mod.RichNoteModal), { ssr: false })

/** Shape returned by GET /api/notes, as far as this page reads it. */
type Note = {
  id: string
  title: string
  content: string
  itemId?: string
  createdAt: string
}

type NoteScope = 'all' | 'linked' | 'loose'
const SCOPE_OPTIONS: { value: NoteScope; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'linked', label: 'Linked to a day' },
  { value: 'loose', label: 'Loose' },
]

/** Plain text of a note's HTML body, used only for search matching. */
const plain = (html: string | null | undefined) => (html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ')

export default function NotesPage() {
  const { showToast, confirm } = useToast()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<NoteScope>('all')

  const fetchNotes = () => {
    fetch('/api/notes')
      .then(r => r.json())
      .then(data => {
        setNotes(data.notes || [])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchNotes()
  }, [])

  const handleEdit = (note: Note) => {
    setEditingNote(note)
    setShowModal(true)
  }

  const handleNew = () => {
    setEditingNote(null)
    setShowModal(true)
  }

  const handleClose = () => {
    setShowModal(false)
    setEditingNote(null)
  }

  const handleDownload = (note: Note) => {
    const blob = new Blob([note.content], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${note.title || 'note'}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDelete = async (note: Note) => {
    if (!(await confirm(`Delete "${note.title || 'Untitled note'}"? This cannot be undone.`))) return
    try {
      const res = await fetch('/api/notes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: note.id }),
      })
      if (!res.ok) {
        showToast('Could not delete note', 'error')
        return
      }
      showToast('Note deleted.', 'success')
      fetchNotes()
    } catch {
      showToast('Could not delete note', 'error')
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return notes.filter(note => {
      if (scope === 'linked' && !note.itemId) return false
      if (scope === 'loose' && note.itemId) return false
      if (!q) return true
      return `${note.title || ''} ${plain(note.content)}`.toLowerCase().includes(q)
    })
  }, [notes, query, scope])

  // Full-page gamified loading gate — same pattern as every other route.
  if (loading) return <Loader routeKey="notes" />

  const filtering = query.trim() !== '' || scope !== 'all'

  return (
    <Page width="wide" className="pb-24">
      <PageHeader
        eyebrow="Journal"
        title={<Scramble text="Notes" mono={false} />}
        meta={notes.length > 0 ? `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}` : undefined}
        description="Rich text notes, each one downloadable."
        actions={
          <Button variant="primary" icon={Plus} onClick={handleNew} data-cursor="Start a fresh page">
            New note
          </Button>
        }
      />

      {notes.length === 0 ? (
        <EmptyState
          title="Nothing written yet"
          body="A single honest sentence today is enough. Start with your first note."
          action={<Button variant="secondary" icon={Plus} onClick={handleNew}>Write the first note</Button>}
        />
      ) : (
        <Section
          title="All notes"
          action={filtering ? (
            <span className="font-mono text-mono tabular-nums text-parchment/45">{visible.length} of {notes.length}</span>
          ) : undefined}
        >
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="relative block w-full sm:max-w-xs">
              <span className="sr-only">Search notes</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-parchment/35" strokeWidth={1.5} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search notes"
                className={cx(inputClass, 'pl-9')}
              />
            </label>
            <Segmented options={SCOPE_OPTIONS} value={scope} onChange={setScope} ariaLabel="Filter notes" />
          </div>

          {visible.length === 0 ? (
            <EmptyState
              title="No notes match"
              body="Try a different word, or clear the filter."
              action={<Button variant="ghost" onClick={() => { setQuery(''); setScope('all') }}>Clear search</Button>}
            />
          ) : (
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visible.map(note => (
                <li key={note.id} className="min-w-0">
                  <Panel className="group flex h-full flex-col gap-3 transition-colors duration-200 hover:border-gold/40">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="min-w-0 break-words text-heading text-parchment">{note.title || 'Untitled note'}</h3>
                      <RowActions
                        label={`Actions for ${note.title || 'note'}`}
                        className="-mr-2 -mt-2"
                        actions={[
                          { label: 'Edit', icon: Pencil, onSelect: () => handleEdit(note) },
                          { label: 'Download', icon: Download, onSelect: () => handleDownload(note) },
                          { label: 'Delete', icon: Trash2, onSelect: () => handleDelete(note), destructive: true },
                        ]}
                      />
                    </div>
                    <div
                      className="prose prose-sm line-clamp-3 max-w-none flex-1 break-words text-body text-parchment/65"
                      dangerouslySetInnerHTML={{ __html: note.content }}
                    />
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <time
                        dateTime={note.createdAt}
                        className="font-mono text-mono tabular-nums text-parchment/40"
                      >
                        {new Date(note.createdAt).toLocaleDateString()}
                      </time>
                      <div className="flex items-center gap-1">
                        {note.itemId && (
                          <Link
                            href={`/day/${new Date(note.itemId).toISOString().split('T')[0]}`}
                            className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 font-mono text-mono text-gold transition-colors hover:text-gold-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 pointer-fine:min-h-9"
                          >
                            View day
                            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                          </Link>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(note)} className="min-h-11 pointer-fine:min-h-9">
                          Edit
                        </Button>
                      </div>
                    </div>
                  </Panel>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {showModal && (
        <RichNoteModal
          onClose={handleClose}
          onSaved={fetchNotes}
          note={editingNote}
        />
      )}
    </Page>
  )
}
