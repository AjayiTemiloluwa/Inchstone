/**
 * Palette — the app's whole colour mood, one level above the accent.
 *
 *   classic   Inchstone's own ink + brass (the stylesheet's :root / .dark)
 *   voltage   neon green, hot pink, lilac
 *   pulse     neon magenta, electric blue, signal green
 *   aurora    electric cyan, violet, lime
 *
 * A palette is a `data-palette` attribute on <html>; globals.css re-points the
 * six base tokens (ink, parchment, gold, gold-dim, ember, moss) and the
 * surfaces for both themes, so every screen re-colours at once. The accent
 * picker still works on top: it only overrides the --gold family inline.
 *
 * Stored in localStorage('inchstone-palette'); the boot script in
 * app/layout.tsx sets the attribute before first paint so nothing flashes.
 */

export const PALETTE_STORAGE_KEY = 'inchstone-palette'

export type PaletteId = 'classic' | 'voltage' | 'pulse' | 'aurora'

export type Palette = {
  id: PaletteId
  name: string
  hint: string
  /** Swatch colours for the picker: background, accent, second, third. */
  swatch: [string, string, string, string]
}

export const PALETTES: Palette[] = [
  { id: 'classic', name: 'Classic', hint: 'Ink and brass, the original Inchstone look', swatch: ['#0a0908', '#b8935a', '#7a3b2e', '#4a5d45'] },
  { id: 'voltage', name: 'Voltage', hint: 'Neon green with hot pink and lilac', swatch: ['#0a0c0b', '#c6ff3d', '#ff4d8d', '#b98bff'] },
  { id: 'pulse', name: 'Pulse', hint: 'Neon magenta with electric blue', swatch: ['#0b0912', '#ff3df2', '#3dd8ff', '#3dff8f'] },
  { id: 'aurora', name: 'Aurora', hint: 'Electric cyan with violet and lime', swatch: ['#060a0f', '#3de8ff', '#a06bff', '#9bff4a'] },
]

export const DEFAULT_PALETTE: PaletteId = 'classic'

const isPalette = (v: unknown): v is PaletteId => PALETTES.some((p) => p.id === v)

export function readPalette(): PaletteId {
  if (typeof window === 'undefined') return DEFAULT_PALETTE
  try {
    const v = window.localStorage.getItem(PALETTE_STORAGE_KEY)
    return isPalette(v) ? v : DEFAULT_PALETTE
  } catch {
    return DEFAULT_PALETTE
  }
}

/** Paints a palette on <html> and remembers it. */
export function applyPalette(id: PaletteId): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (id === 'classic') delete root.dataset.palette
  else root.dataset.palette = id
  try {
    window.localStorage.setItem(PALETTE_STORAGE_KEY, id)
  } catch {
    /* storage blocked — the attribute still applied for this visit */
  }
}
