'use client'

/**
 * InlineEdit — a tiny optimistic text editor.
 *
 * Renders the value as styled text with a hover-reveal pencil. Clicking the
 * pencil swaps it for an inline input/textarea:
 *   – Enter (or Ctrl+Enter on multiline) commits  → calls onSave(next)
 *   – Esc cancels
 *   – Blur commits
 *
 * The caller owns persistence (usually the hierarchy store's updateItem/
 * updateTask, which applies the change to local state instantly and PUTs in
 * the background — no full-screen reload, no flicker).
 *
 * Pointer/keydown events inside the control stop propagation so clicking the
 * pencil never triggers an ancestor card's onClick navigation.
 */

import { useState, useRef } from 'react'
import { Pencil, Check, X } from 'lucide-react'

type InlineEditProps = {
  value: string
  onSave: (next: string) => void
  placeholder?: string
  /** Classes for the display text button (styled like the surrounding heading). */
  className?: string
  /** Classes for the input during editing. */
  inputClassName?: string
  multiline?: boolean
  pencil?: 'hover' | 'always' | 'none'
  title?: string
  maxLength?: number
}

export function InlineEdit({
  value,
  onSave,
  placeholder,
  className = '',
  inputClassName = '',
  multiline = false,
  pencil = 'hover',
  title,
  maxLength,
}: InlineEditProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const submittedRef = useRef(false)

  const startEdit = () => {
    setDraft(value)
    setEditing(true)
  }

  const cancel = () => {
    if (submittedRef.current) return
    setEditing(false)
  }

  const commit = () => {
    if (submittedRef.current) return
    submittedRef.current = true
    const next = draft.trim()
    if (next && next !== value) onSave(next)
    setEditing(false)
    // Reset the guard after the blur/commit pair has settled.
    window.setTimeout(() => {
      submittedRef.current = false
    }, 0)
  }

  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()

  if (editing) {
    const shared = {
      autoFocus: true,
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
      onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => e.currentTarget.select(),
      onBlur: () => commit(),
      placeholder,
      maxLength,
      className:
        inputClassName ||
        'w-full min-w-0 flex-1 rounded-md border border-gold/40 bg-mist/20 px-2 py-1 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-ink/30',
    }

    return (
      <span
        className="inline-flex w-full min-w-0 items-center gap-1"
        onClick={stop}
        onMouseDown={stop}
        onKeyDown={stop}
        onKeyUp={stop}
      >
        {multiline ? (
          <textarea
            {...shared}
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                e.stopPropagation()
                commit()
              }
              if (e.key === 'Escape') {
                e.stopPropagation()
                cancel()
              }
            }}
          />
        ) : (
          <input
            type="text"
            {...shared}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                e.stopPropagation()
                commit()
              }
              if (e.key === 'Escape') {
                e.stopPropagation()
                cancel()
              }
            }}
          />
        )}
        {multiline && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation()
                commit()
              }}
              aria-label="Save"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-gold/15 text-gold transition-colors hover:bg-gold/25"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                cancel()
              }}
              aria-label="Cancel"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-ink/40 transition-colors hover:bg-white/5 hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </span>
    )
  }

  const showPencil = pencil !== 'none'

  return (
    <span className={`group/ie relative inline-flex max-w-full items-center ${showPencil ? 'cursor-text' : ''}`} title={title}>
      <button
        onClick={(e) => {
          e.stopPropagation()
          startEdit()
        }}
        className={`block max-w-full cursor-text truncate text-left ${className} ${!value && placeholder ? 'italic text-ink/35' : ''}`}
      >
        {value || placeholder}
      </button>
      {showPencil && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            startEdit()
          }}
          aria-label="Edit"
          className={`ml-1 grid h-6 w-6 shrink-0 place-items-center rounded-md p-1 text-ink/25 transition-colors hover:bg-gold/15 hover:text-gold ${
            pencil === 'always' ? '' : 'opacity-0 group-hover/ie:opacity-100 focus-visible:opacity-100'
          }`}
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}