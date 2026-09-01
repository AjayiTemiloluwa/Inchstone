'use client'

import { useEffect, useState } from 'react'
import { useVoiceLine } from '@/lib/voice/use-voice-line'
import type { VoiceKey } from '@/lib/voice/types'

/* Every route the app can load, mapped to a voice-bank key so the loader's
   micro-copy is contextual AND time-of-day aware. */
export type LoaderRouteKey =
  | 'calendar'
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year'
  | 'goal'
  | 'finance'
  | 'notes'
  | 'partners'
  | 'reports'
  | 'plans'
  | 'reviews'
  | 'settings'
  | 'dashboard'
  | 'challenge'
  | 'year-quarter'
  | 'year-quarter-month'
  | 'year-quarter-month-week'

const ROUTE_TO_VOICE: Record<LoaderRouteKey, VoiceKey> = {
  calendar: 'loading.calendar',
  day: 'loading.day',
  week: 'loading.week',
  month: 'loading.month',
  quarter: 'loading.quarter',
  year: 'loading.year',
  goal: 'loading.goal',
  finance: 'loading.finance',
  notes: 'loading.notes',
  partners: 'loading.partners',
  reports: 'loading.reports',
  plans: 'loading.plans',
  reviews: 'loading.reviews',
  settings: 'loading.settings',
  dashboard: 'loading.dashboard',
  challenge: 'loading.challenge',
  'year-quarter': 'loading.year-quarter',
  'year-quarter-month': 'loading.year-quarter-month',
  'year-quarter-month-week': 'loading.year-quarter-month-week',
}

/* ────────────────────────────────────────────────────────────────
   GamifiedLoader — a tiny retro platformer loading state.
   A pixel hero sprints along a track collecting coins while a blocky
   progress bar fills with a counting percent and fun mono micro-copy.
   Used on every page (via <Loader/>) — same calm, compounding spirit
   as before, but now it plays the game with you.
   Fully respects prefers-reduced-motion (static, full bar).
   ──────────────────────────────────────────────────────────────── */

const PALETTE: Record<string, string | null> = {
  '.': null,
  H: '#b8935a', // gold hat
  F: '#f3efe6', // parchment face
  E: '#0a0908', // ink eye
  A: '#c9a06a', // gold-dim arm
  B: '#7a3b2e', // ember belt
  L: '#4a5d45', // moss legs/tunic
}

// 10 x 12 blocky runner facing right.
const HERO = [
  '...HHHH..',
  '..HHHHHH.',
  '..HFFFFH.',
  '..HFEFEH.',
  '..HFFFFH.',
  '..HHHHHH.',
  '...LAAAL.',
  '...LLLLL.',
  '..LLLL.L.',
  '.LL....L.',
  '.LL....LL',
  '.L......L',
]

const MESSAGES = [
  'Rolling the dice…',
  'Forging your path…',
  'Leveling up…',
  'Scouting ahead…',
  'Polishing the gold…',
  'Tuning the compass…',
  'Warming the hearth…',
  'Inching forward…',
]

const PIXEL = 4 // px per pixel cell

export function GamifiedLoader({
  label = '',
  compact = false,
  routeKey,
}: {
  label?: string
  compact?: boolean
  /** Optional route context — makes micro-copy contextual + time-aware. */
  routeKey?: LoaderRouteKey
}) {
  const [percent, setPercent] = useState(0)
  const [msg, setMsg] = useState(0)

  // Detected in an effect (never during render) so the server-rendered and
  // first client renders are identical — avoids hydration mismatches.
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  // Fill the bar over ~2.4s, archiving 100 at the end.
  useEffect(() => {
    if (reduced) {
      setPercent(100)
      return
    }
    const id = window.setInterval(() => {
      setPercent((p) => {
        const next = p + Math.max(1, Math.round((100 - p) / 18))
        return Math.min(100, next)
      })
    }, 120)
    return () => window.clearInterval(id)
  }, [reduced])

  // Cycle the micro-copy.
  useEffect(() => {
    if (reduced) return
    const id = window.setInterval(() => setMsg((m) => (m + 1) % MESSAGES.length), 1600)
    return () => window.clearInterval(id)
  }, [reduced])

  const coins = [12, 30, 52, 74, 90]
  const coinsCaught = coins.filter((c) => percent >= c).length

  // When a routeKey is given, the micro-copy comes from the shared voice bank
  // (contextual + time-of-day aware, no immediate repeats) and takes
  // precedence. Otherwise fall back to the explicit label, then the classic
  // rotating flavor line.
  const voiceLine = useVoiceLine(routeKey ? ROUTE_TO_VOICE[routeKey] : 'loading.dashboard')
  const status = routeKey ? voiceLine : (label || MESSAGES[msg])

  // Slim horizontal variant for tight inline spots (tables, cards).
  if (compact) {
    return (
      <div role="status" aria-live="polite" aria-label={status} className="flex w-full flex-col items-center justify-center gap-2 py-4">
        <div className="flex items-center gap-3">
          <div className="relative h-[10px] w-24 overflow-hidden rounded-none border border-gold-dim/25 bg-ink/40">
            <div className="absolute inset-y-0 left-0 bg-gold-glow" style={{ width: `${Math.max(6, percent)}%`, transition: 'width 0.4s cubic-bezier(0.22,1,0.36,1)' }} />
          </div>
          <span className="font-mono text-[11px] tabular-nums text-parchment/45">{String(percent).padStart(3, '0')}%</span>
          <span className="pixel-hero inline-block" aria-hidden="true">
            <span className="block h-2.5 w-2.5 bg-gold" />
          </span>
        </div>
        <p className="font-mono text-xs tracking-wide text-parchment/50">{status}</p>
      </div>
    )
  }

  const heroCells = HERO.map((row) => row.split(''))

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={status}
      className={`flex w-full flex-col items-center justify-center gap-5 px-6 ${compact ? 'min-h-[10rem]' : 'h-full min-h-[45vh]'}`}
    >
      {/* Stage: hero sprints left→right, coins pop as the bar fills */}
      <div className="relative w-full max-w-xs overflow-hidden" aria-hidden="true">
        {/* Track */}
        <div className="relative mt-10 flex h-14 items-end rounded-md border border-gold-dim/25 bg-ink/40 px-4 pb-2">
          {/* ground line */}
          <div className="absolute inset-x-2 bottom-2 h-px bg-gold-dim/40" />

          {/* Coins to collect */}
          {coins.map((c, i) => {
            const caught = percent >= c
            return (
              <span
                key={i}
                className="coin"
                style={{
                  left: `${c}%`,
                  bottom: 14,
                  opacity: caught ? 0 : 1,
                  animationDelay: `${i * 0.25}s`,
                }}
              />
            )
          })}

          {/* Pixel hero */}
          <div
            className="absolute pixel-hero"
            style={{
              left: `${Math.min(percent, 92)}%`,
              bottom: 6,
              transition: reduced ? 'none' : 'left 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <div className="relative" style={{ width: HERO[0].length * PIXEL, height: HERO.length * PIXEL, imageRendering: 'pixelated' }}>
              {heroCells.map((row, y) =>
                row.map((ch, x) => {
                  const color = PALETTE[ch]
                  if (!color) return null
                  return (
                    <span
                      key={`${x}-${y}`}
                      style={{
                        position: 'absolute',
                        left: x * PIXEL,
                        top: y * PIXEL,
                        width: PIXEL,
                        height: PIXEL,
                        background: color,
                      }}
                    />
                  )
                }),
              )}
            </div>
          </div>
        </div>

        {/* Blocky fill bar */}
        <div className="mt-4 flex items-end gap-1">
          {Array.from({ length: 20 }, (_, i) => {
            const on = (i + 1) / 20 <= percent / 100
            return (
              <div
                key={i}
                className={on ? 'pixel-bar-on' : 'pixel-bar-off'}
                style={{
                  width: '1.7em',
                  height: `${8 + ((i % 3) + 1) * 5}px`,
                }}
              />
            )
          })}
        </div>
      </div>

      {/* Status + counts */}
      <div className="flex flex-col items-center gap-1.5">
        <p className="font-mono text-sm tracking-wide text-parchment/70">
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-gold align-middle" />
          {status}
        </p>
        <p className="font-mono text-[11px] tabular-nums tracking-wider text-parchment/40">
          {String(percent).padStart(3, '0')}% · coins {coinsCaught}/{coins.length}
        </p>
      </div>
    </div>
  )
}