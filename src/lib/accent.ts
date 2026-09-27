/**
 * Accent — the single colour the user chooses, which drives the `--gold*`
 * token family:
 *
 *   --gold       the accent itself   (buttons, focus rings, emphasis)
 *   --gold-dim   the accent at rest  (icons, quiet borders, secondary text)
 *   --gold-glow  the accent lifted   (hover fills, highlights)
 *
 * Every colour in the app resolves through those variables (globals.css +
 * tailwind.config.js), so applying an accent is just writing them inline on
 * <html> — inline styles outrank both `:root` (light) and `.dark` (dark), so
 * one write re-hues the entire UI, live, in either theme.
 *
 * The choice persists in localStorage('inchstone-accent'); the derived
 * variables are mirrored to localStorage('inchstone-accent-vars') for BOTH
 * themes so the boot script in layout.tsx can paint the right accent before
 * first paint instead of flashing brass.
 *
 * Framework-free on purpose: the boot script and the picker both use it.
 */

export const ACCENT_STORAGE_KEY = 'inchstone-accent'
export const ACCENT_VARS_STORAGE_KEY = 'inchstone-accent-vars'

/** The stock brass accent, i.e. what the stylesheet already declares. */
export const STOCK_ACCENT_HEX = '#b8935a'

export type AccentPreset = { id: string; name: string; hint: string; hex: string }

/**
 * The mixing palette — one mute hue per mood, all sampled in the same quiet
 * register as the stock brass so nothing here shouts. `hex` is the ink-side
 * accent; the paper-side accent and the rest/lift tones are mixed from it.
 */
export const ACCENT_PRESETS: AccentPreset[] = [
  { id: 'brass', name: 'Brass', hint: 'The canonical accent', hex: '#b8935a' },
  { id: 'moss', name: 'Moss', hint: 'Rooted and quiet', hex: '#93ac7e' },
  { id: 'clay', name: 'Clay', hint: 'Warm terracotta', hex: '#c9855f' },
  { id: 'rosewood', name: 'Rosewood', hint: 'A softer red', hex: '#cc8a90' },
  { id: 'amethyst', name: 'Amethyst', hint: 'A violet mood', hex: '#b191cc' },
  { id: 'indigo', name: 'Indigo', hint: 'Cool and deep', hex: '#92a0d6' },
  { id: 'teal', name: 'Teal', hint: 'Sea green', hex: '#77b6ae' },
  { id: 'slate', name: 'Slate', hint: 'Neutral silver', hex: '#a9b2ba' },
]

export const DEFAULT_ACCENT_ID = 'brass'

/** default → the stock brass · preset → the mixing palette · custom → any hex */
export type AccentChoice =
  | { kind: 'default' }
  | { kind: 'preset'; id: string }
  | { kind: 'custom'; hex: string }

export type AccentMix = {
  accent: string
  accentRgb: string
  rest: string
  restRgb: string
  lift: string
  liftRgb: string
}

/* ── Colour maths ─────────────────────────────────────────────────────── */

type Rgb = { r: number; g: number; b: number }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const toHex = ({ r, g, b }: Rgb) =>
  '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('')

/** Space-separated triplet — the shape the Tailwind alpha tokens expect. */
const toTriplet = ({ r, g, b }: Rgb) =>
  `${Math.round(clamp(r, 0, 255))} ${Math.round(clamp(g, 0, 255))} ${Math.round(clamp(b, 0, 255))}`

/** Accepts `#rgb` / `#rrggbb`, with or without the hash. */
export function parseHex(input: string): Rgb | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((input ?? '').trim())
  if (!match) return null
  const raw = match[1].length === 3 ? match[1].split('').map(c => c + c).join('') : match[1]
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  }
}

/** Normalises any accepted form to `#rrggbb`, or null when it isn't a colour. */
export function normaliseHex(input: string): string | null {
  const rgb = parseHex(input)
  return rgb ? toHex(rgb) : null
}

function toHsl({ r, g, b }: Rgb) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l }
  const s = d / (1 - Math.abs(2 * l - 1))
  const h =
    max === rn
      ? 60 * (((gn - bn) / d) % 6)
      : max === gn
        ? 60 * ((bn - rn) / d + 2)
        : 60 * ((rn - gn) / d + 4)
  return { h: (h + 360) % 360, s, l }
}

function fromHsl(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x]
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 }
}

/** Scales lightness and saturation of a hue. `1` leaves a channel alone. */
function tune(hex: string, lightness: number, saturation = 1): string {
  const rgb = parseHex(hex)
  if (!rgb) return hex
  const { h, s, l } = toHsl(rgb)
  return toHex(fromHsl(h, clamp(s * saturation, 0, 1), clamp(l * lightness, 0, 1)))
}

/**
 * Mixes the three tones from one picked colour.
 *
 * The ink-side ratios were reverse-engineered from the stock brass pair
 * (#b8935a → #8a6d42 at rest, #cbaa6f lifted) and the paper-side pair
 * (#96762f → #b08e52), then generalised to any hue — so choosing Brass
 * reproduces today's look exactly, and every other hue keeps the same
 * rest/lift relationships.
 */
export function mixAccent(base: string, dark: boolean): AccentMix {
  const safe = normaliseHex(base) ?? STOCK_ACCENT_HEX
  const accent = dark ? safe : tune(safe, 0.729, 1.341)
  const rest = tune(safe, 0.75, 0.9)
  const lift = dark ? tune(safe, 1.162, 1.204) : tune(safe, 0.955, 0.956)
  return {
    accent,
    accentRgb: toTriplet(parseHex(accent) as Rgb),
    rest,
    restRgb: toTriplet(parseHex(rest) as Rgb),
    lift,
    liftRgb: toTriplet(parseHex(lift) as Rgb),
  }
}

/** Ink or parchment, whichever stays legible on top of `hex`. */
export function readableOn(hex: string): string {
  const rgb = parseHex(hex) ?? { r: 10, g: 9, b: 8 }
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255
  return luminance > 0.55 ? '#0a0908' : '#fffdf6'
}

/* ── Applying ─────────────────────────────────────────────────────────── */

const VAR_KEYS = ['--gold', '--gold-rgb', '--gold-dim', '--gold-dim-rgb', '--gold-glow-rgb'] as const

/** The custom properties that carry a mix, ready for setProperty. */
export function accentVars(mix: AccentMix): Record<string, string> {
  return {
    '--gold': mix.accent,
    '--gold-rgb': mix.accentRgb,
    '--gold-dim': mix.rest,
    '--gold-dim-rgb': mix.restRgb,
    '--gold-glow-rgb': mix.liftRgb,
  }
}

/** The colour a choice is built from — its ink-side accent. */
export function choiceHex(choice: AccentChoice): string {
  if (choice.kind === 'preset') {
    return ACCENT_PRESETS.find(preset => preset.id === choice.id)?.hex ?? STOCK_ACCENT_HEX
  }
  if (choice.kind === 'custom') return normaliseHex(choice.hex) ?? STOCK_ACCENT_HEX
  return STOCK_ACCENT_HEX
}

/** The mix a choice paints with in a given theme. */
export function choiceMix(choice: AccentChoice, dark: boolean): AccentMix {
  return mixAccent(choiceHex(choice), dark)
}

/** A custom choice from any accepted hex; null when it isn't a colour. */
export function customChoice(input: string): AccentChoice | null {
  const hex = normaliseHex(input)
  return hex ? { kind: 'custom', hex } : null
}

export function readAccentChoice(): AccentChoice {
  if (typeof window === 'undefined') return { kind: 'default' }
  try {
    const raw = window.localStorage.getItem(ACCENT_STORAGE_KEY)
    if (!raw) return { kind: 'default' }
    const parsed = JSON.parse(raw) as { kind?: string; id?: string; hex?: string }
    if (parsed?.kind === 'preset' && typeof parsed.id === 'string') {
      return ACCENT_PRESETS.some(preset => preset.id === parsed.id)
        ? { kind: 'preset', id: parsed.id }
        : { kind: 'default' }
    }
    if (parsed?.kind === 'custom' && typeof parsed.hex === 'string') {
      return customChoice(parsed.hex) ?? { kind: 'default' }
    }
  } catch {
    /* storage blocked or corrupt — fall back to the stock accent */
  }
  return { kind: 'default' }
}

/** Writes a mix onto <html>. The stock brass is unset so the stylesheet wins. */
function paint(choice: AccentChoice): void {
  const root = document.documentElement
  if (choiceHex(choice) === STOCK_ACCENT_HEX) {
    for (const key of VAR_KEYS) root.style.removeProperty(key)
    return
  }
  const vars = accentVars(choiceMix(choice, root.classList.contains('dark')))
  for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, value)
}

/** Adopts an accent and remembers it for the next visit. */
export function applyAccent(choice: AccentChoice): void {
  if (typeof document === 'undefined') return
  paint(choice)
  try {
    const hex = choiceHex(choice)
    if (hex === STOCK_ACCENT_HEX) {
      window.localStorage.setItem(ACCENT_STORAGE_KEY, JSON.stringify({ kind: 'default' }))
      window.localStorage.removeItem(ACCENT_VARS_STORAGE_KEY)
      return
    }
    window.localStorage.setItem(ACCENT_STORAGE_KEY, JSON.stringify(choice))
    // Both theme sets, so the boot script can paint without doing colour maths.
    window.localStorage.setItem(
      ACCENT_VARS_STORAGE_KEY,
      JSON.stringify({
        dark: accentVars(mixAccent(hex, true)),
        light: accentVars(mixAccent(hex, false)),
      }),
    )
  } catch {
    /* storage unavailable — the inline variables still applied */
  }
}

/**
 * Re-asserts the stored accent for the current theme. Used after a theme flip
 * (the paper and ink mixes differ) and on mount, since the boot script painted
 * before hydration.
 */
export function applyStoredAccent(): AccentChoice {
  const choice = readAccentChoice()
  if (typeof document !== 'undefined') paint(choice)
  return choice
}
