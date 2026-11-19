/**
 * Deed colours — a named palette that re-tunes itself to the theme.
 *
 * A deed stores a hue *name* ("sky", "coral"…) in Task.color. The actual colour comes
 * from CSS variables (--hue-<name>-rgb in globals.css), defined four times:
 *   Classic light  → deep, earthy jewel tones that read on paper
 *   Classic dark   → softened jewels that sit beside brass on ink
 *   Mood light     → saturated, clean colours on white
 *   Mood dark      → full neon, to match Voltage / Pulse / Aurora
 * so one choice looks right in every mood and in light and dark mode.
 *
 * Older deeds stored a fixed hex from the previous swatch row; those map to the nearest
 * hue so they adapt too. Any other hex (e.g. set by the assistant) is shown as-is.
 */

export const DEED_HUES = [
  { id: 'coral', name: 'Coral' },
  { id: 'amber', name: 'Amber' },
  { id: 'lime', name: 'Lime' },
  { id: 'mint', name: 'Mint' },
  { id: 'teal', name: 'Teal' },
  { id: 'sky', name: 'Sky' },
  { id: 'indigo', name: 'Indigo' },
  { id: 'violet', name: 'Violet' },
  { id: 'rose', name: 'Rose' },
] as const

export type DeedHue = (typeof DEED_HUES)[number]['id']

const HUE_IDS = new Set<string>(DEED_HUES.map((h) => h.id))

/** The old fixed swatches (AddDeedForm before Nov 2026), mapped to the hue they were closest to. */
const LEGACY: Record<string, DeedHue> = {
  '#d4af37': 'amber', '#ffd700': 'amber', '#ffb347': 'amber',
  '#8fbc8f': 'mint', '#a8e6cf': 'mint', '#3cb371': 'lime',
  '#6495ed': 'sky', '#00bfff': 'sky',
  '#ff7f50': 'coral', '#ff6b6b': 'rose',
  '#9370db': 'violet', '#ba68c8': 'violet',
}

/** The hue a stored colour stands for, or null for "no colour" / a custom hex. */
export function deedHue(color: string | null | undefined): DeedHue | null {
  if (!color) return null
  const c = color.trim().toLowerCase()
  if (HUE_IDS.has(c)) return c as DeedHue
  return LEGACY[c] ?? null
}

/** The RGB-triplet variable for a hue. (No colour = the mood's accent; see deedCss.) */
export function hueVar(hue: DeedHue): string {
  return `var(--hue-${hue}-rgb)`
}

/**
 * A CSS colour for a deed's stored colour, with optional alpha.
 * Falls back to the mood's accent (or moss when done) when the deed has none.
 */
export function deedCss(color: string | null | undefined, opts: { alpha?: number; completed?: boolean } = {}): string {
  const a = opts.alpha ?? 1
  const hue = deedHue(color)
  if (hue) return `rgb(${hueVar(hue)} / ${a})`
  if (color && /^#[0-9a-f]{3,8}$/i.test(color.trim())) {
    return a >= 1 ? color.trim() : `color-mix(in srgb, ${color.trim()} ${Math.round(a * 100)}%, transparent)`
  }
  return `rgb(var(${opts.completed ? '--moss-rgb' : '--gold-rgb'}) / ${a})`
}

/** True when a stored colour is a palette hue (or a legacy swatch that maps to one). */
export const isPaletteColor = (color: string | null | undefined) => deedHue(color) !== null
