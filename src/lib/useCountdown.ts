'use client'

import { useEffect, useState } from 'react'

/**
 * useCountdown — a lightweight second-ticker for live countdowns.
 *
 * Returns a fresh `now` Date every `intervalMs` (default 1000ms). Because the
 * component re-renders once per tick, keep derived countdown strings cheap.
 * Disabled for prefers-reduced-motion (returns a static date) so animating
 * numerals don't churn for users who asked for calm.
 */
export function useCountdown(intervalMs = 1000): Date {
  const [now, setNow] = useState<Date>(() => new Date())

  useEffect(() => {
    if (typeof window === 'undefined') return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])

  return now
}

/* ── Pure countdown formatting helpers (easy to unit test) ─────────── */

export type CountdownState = 'future' | 'live' | 'past'

export function getCountdownState(
  from: Date,
  start: Date,
  end: Date | null
): CountdownState {
  const t = from.getTime()
  if (t < start.getTime()) return 'future'
  if (!end) return 'live'
  if (t <= end.getTime()) return 'live'
  return 'past'
}

export interface CountdownParts {
  state: CountdownState
  /** true when problem is imminent (≤ 10 min away) */
  soon: boolean
  d: number
  h: number
  m: number
  s: number
  /** total seconds remaining until the target */
  totalSeconds: number
}

/** Split a millisecond delta into d/h/m/s parts for readable display. */
export function splitCountdown(deltaMs: number): Pick<CountdownParts, 'd' | 'h' | 'm' | 's' | 'totalSeconds'> {
  const totalSeconds = Math.max(0, Math.floor(deltaMs / 1000))
  const d = Math.floor(totalSeconds / 86400)
  const h = Math.floor((totalSeconds % 86400) / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return { d, h, m, s, totalSeconds }
}

/**
 * Build a compact label like `in 2h 34m`, `LIVE`, or `2h 4m ago`.
 */
export function formatCountdown(from: Date, start: Date, end: Date | null): CountdownParts {
  const t = from.getTime()
  const sT = start.getTime()
  const state = getCountdownState(from, start, end)

  if (state === 'future') {
    const { d, h, m, s, totalSeconds } = splitCountdown(sT - t)
    return { state, soon: totalSeconds <= 600, d, h, m, s, totalSeconds }
  }

  if (state === 'live') {
    const endT = end ? end.getTime() : Infinity
    const remaining = endT === Infinity ? 0 : endT - t
    if (endT === Infinity) return { state, soon: false, d: 0, h: 0, m: 0, s: 0, totalSeconds: 0 }
    const { d, h, m, s, totalSeconds } = splitCountdown(remaining)
    return { state, soon: totalSeconds <= 600, d, h, m, s, totalSeconds }
  }

  // past — time elapsed since it started
  const { d, h, m, s, totalSeconds } = splitCountdown(t - sT)
  return { state, soon: false, d, h, m, s, totalSeconds }
}

/** Compact human label built from Parts — `02:14:09`, `1d 03:12`, etc. */
export function compactCountdownLabel(p: CountdownParts): string {
  if (p.state === 'live') {
    if (p.totalSeconds <= 0) return 'LIVE'
    if (p.d > 0) return `${p.d}d ${String(p.h).padStart(2, '0')}:${String(p.m).padStart(2, '0')}`
    return `${String(p.h).padStart(2, '0')}:${String(p.m).padStart(2, '0')}:${String(p.s).padStart(2, '0')}`
  }
  if (p.state === 'future') {
    if (p.d > 0) return `in ${p.d}d ${p.h}h`
    if (p.h > 0) return `in ${p.h}h ${p.m}m`
    if (p.m > 0) return `in ${p.m}m`
    return `in ${p.s}s`
  }
  // past
  if (p.d > 0) return `${p.d}d ago`
  if (p.h > 0) return `${p.h}h ago`
  if (p.m > 0) return `${p.m}m ago`
  return `${p.s}s ago`
}
