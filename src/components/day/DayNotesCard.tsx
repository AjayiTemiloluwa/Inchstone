'use client'

import { BookOpen, Plus, StickyNote } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Scramble } from '@/components/ui/motion'
import type { DayNote } from './types'

export function DayNotesCard({
  notes,
  onAdd,
  onEdit,
}: {
  notes: DayNote[]
  onAdd: () => void
  onEdit: (note: DayNote) => void
}) {
  return (
<Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <StickyNote className="w-5 h-5 text-gold" />
            <h2 className="text-xl font-display font-bold text-ink"><Scramble text="Day Notes" mono={false} /></h2>
          </div>
          <button
            onClick={onAdd}
            data-cursor="Jot a note"
            className="px-3 py-1.5 text-xs font-medium bg-ink text-surface rounded hover:bg-ink/90 transition flex items-center space-x-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Note</span>
          </button>
        </div>
        {notes.length === 0 ? (
          <p className="text-xs text-ink/40 text-center py-4">No notes for this day yet.</p>
        ) : (
          <div className="space-y-3">
            {notes.map(note => (
              <div key={note.id} className="bg-black/20 border border-white/10 rounded-xl p-4 hover:border-gold/50 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-ink break-words">{note.title}</h4>
                    <div
                      className="text-xs text-ink/70 mt-1 prose prose-sm max-w-none line-clamp-2"
                      dangerouslySetInnerHTML={{ __html: note.content }}
                    />
                    <p className="text-[10px] text-ink/40 mt-2 font-mono">
                      {new Date(note.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-1 ml-3">
                    <button
                      onClick={() => onEdit(note)}
                      className="p-2 sm:p-1.5 hover:bg-mist rounded transition text-ink/50 hover:text-gold"
                      title="Edit note"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
  )
}
