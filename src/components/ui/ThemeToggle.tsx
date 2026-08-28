'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

/**
 * ThemeToggle — dark ↔ light with a flick of the class on <html>.
 * The token system in globals.css does the rest (every color is var-driven).
 * Choice persists in localStorage("theme"), which the boot script in
 * layout.tsx respects before first paint.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(true)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
    setReady(true)
  }, [])

  const toggle = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    try { localStorage.setItem('theme', next ? 'dark' : 'light') } catch { /* ignore */ }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', next ? '#0A0908' : '#F6F1E7')
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      data-cursor={dark ? 'Flip the lights' : 'Dim it down'}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold-dim/30 text-gold-dim transition-colors hover:border-gold/50 hover:text-gold"
    >
      {ready && (dark ? <Sun className="h-4 w-4" strokeWidth={1.5} /> : <Moon className="h-4 w-4" strokeWidth={1.5} />)}
    </button>
  )
}