'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'

interface Command {
  id: string
  label: string
  hint?: string
  icon: string
  action: (router: ReturnType<typeof useRouter>) => void
  keywords?: string
}

const NAV: Array<Omit<Command, 'action'>> = [
  { id: 'dashboard', label: 'Dashboard', icon: '🧭', keywords: 'home today compass' },
  { id: 'year', label: 'Year view', icon: '🗓️', keywords: 'annual quarters months' },
  { id: 'calendar', label: 'Calendar', icon: '📅', keywords: 'month weeks schedule' },
  { id: 'day-today', label: 'Open today', hint: format(new Date(), 'EEE, MMM d'), icon: '☀️', keywords: 'day deeds habits now' },
  { id: 'finance', label: 'Finance & Budgeting', icon: '💰', keywords: 'money purses budget ledger transactions' },
  { id: 'notes', label: 'Notes', icon: '📝', keywords: 'journal writing' },
  { id: 'reviews', label: 'Periodic Reviews', icon: '🔁', keywords: 'weekly monthly reflection mood' },
  { id: 'reports', label: 'Reports', icon: '📈', keywords: 'analytics progress' },
  { id: 'partners', label: 'Partners', icon: '🤝', keywords: 'accountability shared' },
  { id: 'settings', label: 'Settings', icon: '⚙️', keywords: 'preferences config' },
]

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const commands: Command[] = NAV.map(c => ({
    ...c,
    action: (r) => {
      if (c.id === 'day-today') r.push(`/day/${format(new Date(), 'yyyy-MM-dd')}`)
      else r.push(`/${c.id}`)
    },
  }))

  const filtered = commands.filter(c => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (c.label + ' ' + (c.keywords || '')).toLowerCase().includes(q)
  })

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setActive(0)
  }, [])

  const run = useCallback((cmd: Command | undefined) => {
    if (!cmd) return
    close()
    cmd.action(router)
  }, [close, router])

  // Global shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Focus + scroll active into view
  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 30)
    else { setQuery(''); setActive(0) }
  }, [open])

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, filtered.length])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center pt-[12vh] px-4 bg-ink/70 backdrop-blur-sm"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-lg rounded-xl border border-gold-dim/25 bg-surface-solid shadow-2xl shadow-black/50 overflow-hidden animate-fadeIn"
        onClick={e => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); close() }
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, filtered.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
          if (e.key === 'Enter') { e.preventDefault(); run(filtered[active]) }
        }}
      >
        <div className="flex items-center gap-2.5 border-b border-white/10 px-4">
          <span className="text-parchment/40 text-sm">⌘</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0) }}
            placeholder="Where to?"
            className="flex-1 bg-transparent py-3.5 text-sm text-parchment placeholder:text-parchment/30 focus:outline-none"
          />
          <kbd className="rounded border border-white/10 bg-black/20 px-1.5 py-0.5 font-mono text-[10px] text-parchment/40">esc</kbd>
        </div>

        <div ref={listRef} className="max-h-[46vh] overflow-y-auto p-2" data-lenis-prevent>
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-parchment/40">No matches for “{query}”</p>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                data-active={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => run(cmd)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  i === active ? 'bg-gold/15 text-parchment' : 'text-parchment/70 hover:bg-white/5'
                }`}
              >
                <span className="text-base w-6 text-center shrink-0">{cmd.icon}</span>
                <span className="flex-1 text-sm font-medium truncate">{cmd.label}</span>
                {cmd.hint && <span className="font-mono text-[10px] text-parchment/40 shrink-0">{cmd.hint}</span>}
                {i === active && <span className="font-mono text-[10px] text-gold shrink-0">↵</span>}
              </button>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/10 px-4 py-2">
          <p className="font-mono text-[10px] text-parchment/30">↑↓ navigate · ↵ open</p>
          <p className="font-mono text-[10px] text-parchment/30">Inchstone</p>
        </div>
      </div>
    </div>
  )
}