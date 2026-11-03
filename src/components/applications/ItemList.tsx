'use client'

import { useRef, useState } from 'react'
import { Check, Paperclip, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { Badge, Button, IconButton, RowActions, cx, inputClass, type Tone } from '@/components/ds'
import { ITEM_STATUSES, type ItemKind } from '@/lib/applications'
import { formatBytes, fromLocalInput, selectClass, textareaClass, toDateInput } from './shared'

export interface AppItem {
  id: string
  kind: ItemKind
  label: string
  detail: string | null
  status: string
  dueDate: string | null
  fileId: string | null
  order: number
}

export interface AppFile {
  id: string
  name: string
  mime: string
  size: number
  label: string | null
  createdAt: string
}

const STATUS_TONE: Record<string, Tone> = {
  met: 'moss', partial: 'gold', unmet: 'ember', unknown: 'neutral',
  todo: 'neutral', drafting: 'gold', ready: 'moss', done: 'moss',
}

const PLACEHOLDER: Record<ItemKind, string> = {
  eligibility: 'Add a requirement, e.g. "2 years of work experience"',
  document: 'Add something you need, e.g. "Personal statement"',
  step: 'Add a step, e.g. "Ask Dr. Bello for a reference"',
}

export function ItemList({
  kind,
  items,
  files,
  appId,
  onAdd,
  onPatch,
  onDelete,
  onUpload,
}: {
  kind: ItemKind
  items: AppItem[]
  files: AppFile[]
  appId: string
  onAdd: (kind: ItemKind, label: string) => Promise<void>
  onPatch: (id: string, patch: Partial<AppItem>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onUpload: (file: File, itemId?: string) => Promise<void>
}) {
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editDetail, setEditDetail] = useState('')
  const [editDue, setEditDue] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const uploadFor = useRef<string | undefined>(undefined)

  const add = async () => {
    const l = draft.trim()
    if (!l) return
    setDraft('')
    await onAdd(kind, l)
  }

  const startEdit = (it: AppItem) => {
    setEditing(it.id)
    setEditLabel(it.label)
    setEditDetail(it.detail || '')
    setEditDue(toDateInput(it.dueDate))
  }

  const saveEdit = async (it: AppItem) => {
    if (!editLabel.trim()) return
    await onPatch(it.id, { label: editLabel.trim(), detail: editDetail.trim() || null, dueDate: fromLocalInput(editDue) })
    setEditing(null)
  }

  const fileById = (id: string | null) => (id ? files.find((f) => f.id === id) : undefined)

  return (
    <div className="space-y-2">
      <input
        ref={fileInput}
        type="file"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) await onUpload(f, uploadFor.current)
        }}
      />
      {items.length === 0 && <p className="text-caption text-parchment/40">Nothing here yet.</p>}
      <ul className="divide-y divide-gold/10 overflow-hidden rounded-xl border border-gold/15 bg-surface-solid empty:hidden">
        {items.map((it) => {
          const file = fileById(it.fileId)
          const done = it.status === 'done'
          if (editing === it.id) {
            return (
              <li key={it.id} className="space-y-3 p-4">
                <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className={inputClass} aria-label="Label" autoFocus />
                <textarea value={editDetail} onChange={(e) => setEditDetail(e.target.value)} rows={2} placeholder="Details, notes, links"
                  className={textareaClass} aria-label="Details" />
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/45">Due by</span>
                    <input type="date" value={editDue} onChange={(e) => setEditDue(e.target.value)} className={cx(inputClass, 'w-auto')} />
                  </label>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                    <Button variant="primary" size="sm" onClick={() => saveEdit(it)}>Save</Button>
                  </div>
                </div>
              </li>
            )
          }
          return (
            <li key={it.id} className="group flex items-start gap-3 px-4 py-4 pointer-fine:py-3">
              {kind === 'step' ? (
                <button
                  type="button"
                  onClick={() => onPatch(it.id, { status: done ? 'todo' : 'done' })}
                  aria-label={done ? `Mark "${it.label}" not done` : `Mark "${it.label}" done`}
                  aria-pressed={done}
                  className={cx(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 transition-colors pointer-fine:h-6 pointer-fine:w-6 pointer-fine:rounded-md pointer-fine:border',
                    done ? 'border-moss bg-moss/20 text-moss' : 'border-gold/30 text-transparent hover:border-gold/60',
                  )}
                >
                  <Check className="h-5 w-5 pointer-fine:h-3.5 pointer-fine:w-3.5" strokeWidth={3} />
                </button>
              ) : null}

              <div className="min-w-0 flex-1">
                <p className={cx('text-base leading-snug pointer-fine:text-sm', done ? 'text-parchment/40 line-through' : 'text-parchment')}>{it.label}</p>
                {it.detail && <p className="mt-0.5 whitespace-pre-wrap text-caption text-parchment/50">{it.detail}</p>}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {it.dueDate && <Badge tone="neutral">by {new Date(it.dueDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</Badge>}
                  {file && (
                    <a href={`/api/applications/${appId}/files/${file.id}`} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-caption text-gold hover:underline">
                      <Paperclip className="h-3 w-3" aria-hidden="true" /> {file.name} <span className="text-parchment/35">{formatBytes(file.size)}</span>
                    </a>
                  )}
                </div>
              </div>

              {kind !== 'step' && (
                <select
                  value={it.status}
                  onChange={(e) => onPatch(it.id, { status: e.target.value })}
                  aria-label={`Status of ${it.label}`}
                  className={cx(selectClass, 'w-auto min-w-0 shrink-0 pointer-fine:min-h-9', toneText(STATUS_TONE[it.status]))}
                >
                  {ITEM_STATUSES[kind].map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              )}

              {kind === 'document' && (
                <IconButton icon={Upload} label={`Upload a file for ${it.label}`}
                  onClick={() => { uploadFor.current = it.id; fileInput.current?.click() }} />
              )}

              <RowActions
                actions={[
                  { label: 'Edit', icon: Pencil, onSelect: () => startEdit(it) },
                  ...(file ? [{ label: 'Detach file', icon: Paperclip, onSelect: () => onPatch(it.id, { fileId: null }) }] : []),
                  { label: 'Delete', icon: Trash2, destructive: true, onSelect: () => onDelete(it.id) },
                ]}
              />
            </li>
          )
        })}
      </ul>

      <form
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); add() }}
      >
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={PLACEHOLDER[kind]} className={inputClass} aria-label={PLACEHOLDER[kind]} />
        <Button type="submit" variant="secondary" icon={Plus} disabled={!draft.trim()} aria-label="Add">
          <span className="hidden sm:inline">Add</span>
        </Button>
      </form>
    </div>
  )
}

function toneText(t: Tone | undefined) {
  return t === 'moss' ? 'text-moss' : t === 'ember' ? 'text-ember' : t === 'gold' ? 'text-gold' : 'text-parchment/70'
}
