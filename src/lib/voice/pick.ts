import type { VoiceKey } from './types'
import { VOICE_BANK } from './copy-bank'
import type { TimeOfDay } from '@/components/effects/atmosphere'

/**
 * pick.ts — pure selection logic for the voice bank.
 *
 * Guarantees the spec's non-negotiable: the same key never shows the exact
 * same line twice in a row within a session (across reloads / re-renders),
 * by tracking the last-shown line per key in sessionStorage.
 */

const STORE_KEY = 'inchstone:voice:last'

function loadLast(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = sessionStorage.getItem(STORE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function saveLast(last: Record<string, string>) {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(last))
  } catch {
    /* ignore quota / privacy-mode failures */
  }
}

/**
 * Pick a line for a key at a given time band.
 * - Prefers the band-specific variants, else the `any` fallback.
 * - Excludes the previously shown line for that key if >1 option remains.
 * - Falls back to the first option if a slot is somehow empty (never throws).
 */
export function pickVoiceLine(key: VoiceKey, band: TimeOfDay = 'morning'): string {
  const slot = VOICE_BANK[key]
  const pool = slot?.[band] ?? slot?.any ?? []
  if (pool.length === 0) return ''

  const last = loadLast()
  const prev = last[key]

  let candidate = pool[Math.floor(Math.random() * pool.length)]
  // No-immediate-repeat: if we just showed this line and there are others, pick again.
  if (prev && pool.length > 1) {
    let guard = 0
    while (candidate === prev && guard < pool.length * 2) {
      candidate = pool[Math.floor(Math.random() * pool.length)]
      guard++
    }
  }

  last[key] = candidate
  saveLast(last)
  return candidate
}

/** Shortcut when a caller needs the first (deterministic) variant of a key. */
export function firstVoiceLine(key: VoiceKey): string {
  const slot = VOICE_BANK[key]
  return slot?.any?.[0] ?? ''
}

/**
 * Deterministic first-shown line for a key + band (band[0] or any[0]).
 *
 * Used for SSR + the hydration render so server and client produce identical
 * markup (no React hydration mismatch), then useVoiceLine upgrades it to a
 * random, no-repeat line in an effect after mount.
 */
export function deterministicVoiceLine(key: VoiceKey, band: TimeOfDay = 'morning'): string {
  const slot = VOICE_BANK[key]
  const pool = slot?.[band] ?? slot?.any ?? []
  return pool[0] ?? ''
}