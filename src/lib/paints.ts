/**
 * Paints — the vivid colours you can throw at Inchstone (components/fun/PaintDrops.tsx).
 *
 * A paint is an accent: throwing one calls applyAccent() with its colour, so it drives the same
 * --gold* tokens as Settings → Accent, survives reloads, and follows light/dark (lib/accent.ts
 * mixes a paper-side shade that stays readable on the light theme). Brass is the original.
 */
import { STOCK_ACCENT_HEX, choiceHex, readAccentChoice, type AccentChoice } from '@/lib/accent'

export interface Paint {
  id: string
  name: string
  /** A few words for the wheel's hub. */
  vibe: string
  /** The ink-side colour; the paper-side shade is mixed from it. */
  hex: string
}

export const PAINTS: Paint[] = [
  { id: 'brass', name: 'Brass', vibe: 'the original Inchstone', hex: STOCK_ACCENT_HEX },
  { id: 'emerald', name: 'Emerald', vibe: 'electric green', hex: '#0ae448' },
  { id: 'ultraviolet', name: 'Ultraviolet', vibe: 'electric violet', hex: '#b08cff' },
  { id: 'sunset', name: 'Sunset', vibe: 'hot orange', hex: '#ff8c32' },
  { id: 'ocean', name: 'Ocean', vibe: 'deep sea blue', hex: '#38c8ff' },
  { id: 'bubblegum', name: 'Bubblegum', vibe: 'loud pink', hex: '#ff78cd' },
  { id: 'citrus', name: 'Citrus', vibe: 'zesty lime', hex: '#e2ff28' },
  { id: 'coral', name: 'Coral', vibe: 'warm red', hex: '#ff6e78' },
]

/** The accent choice a paint becomes. Brass is the stock accent (the stylesheet's own). */
export const paintChoice = (p: Paint): AccentChoice => (p.hex === STOCK_ACCENT_HEX ? { kind: 'default' } : { kind: 'custom', hex: p.hex })

/** Index of the paint the stored accent matches, or -1 when the accent came from Settings. */
export function currentPaintIndex(): number {
  const hex = choiceHex(readAccentChoice()).toLowerCase()
  return PAINTS.findIndex((p) => p.hex.toLowerCase() === hex)
}

/** Fired after a paint is thrown, so other accent controls (Settings) can re-read it. */
export const ACCENT_CHANGE_EVENT = 'inchstone-accent-change'
