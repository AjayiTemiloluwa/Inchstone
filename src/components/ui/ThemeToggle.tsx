'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

/**
 * ThemeToggle — dark ↔ light with a flick of the class on <html>.
 * The token system in globals.css does the rest (every color is var-driven).
 * Choice persists in localStorage("theme"), which the boot script in
 * layout.tsx respects before first paint.
 */

function applyTheme(next: boolean) {
  document.documentElement.classList.toggle('dark', next)
  try { localStorage.setItem('theme', next ? 'dark' : 'light') } catch { /* ignore */ }
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', next ? '#0A0908' : '#F6F1E7')
}

export function ThemeToggle() {
  const [dark, setDark] = useState(true)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Mounted-gate: read the live class after mount so server HTML (no icon)
    // and first client paint agree, whatever the stored theme is.
    const raf = requestAnimationFrame(() => {
      setDark(document.documentElement.classList.contains('dark'))
      setReady(true)
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  const toggle = () => {
    const next = !dark
    setDark(next)
    applyTheme(next)
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

/**
 * ThemeSwitch — the Settings "Appearance" quiet switch (Light | Dark).
 * The active side carries the gold underline, per the design plan. Reads the
 * live class in a lazy initializer — Settings renders the switch only after
 * Clerk loads, so it never appears in server HTML (no hydration mismatch).
 */
export function ThemeSwitch() {
  const [dark, setDark] = useState(() =>
    typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
  )

  const apply = (next: boolean) => {
    setDark(next)
    applyTheme(next)
  }

  const options = [
    { label: 'Light', value: false, hint: 'Flip the lights' },
    { label: 'Dark', value: true, hint: 'Dim it down' },
  ]

  return (
    <div className="flex items-center gap-6" role="group" aria-label="Theme">
      {options.map(o => {
        const active = dark === o.value
        return (
          <button
            key={o.label}
            onClick={() => apply(o.value)}
            aria-pressed={active}
            data-cursor={o.hint}
            className={`relative pb-1.5 text-sm font-semibold transition-colors ${
              active ? 'text-parchment' : 'text-parchment/40 hover:text-parchment/70'
            }`}
          >
            {o.label}
            <span
              aria-hidden
              className={`absolute inset-x-0 bottom-0 h-0.5 bg-gold transition-opacity duration-200 ${
                active ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </button>
        )
      })}
    </div>
  )
}