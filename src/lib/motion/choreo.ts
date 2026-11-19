import { gsap } from '@/lib/gsap'

/**
 * The choreographer — why no two visits to a page move the same way.
 *
 * Every visit to a route gets its own "show": a seeded shuffle of the entrance library
 * (the DECK) and a flow (the ORDER things arrive in). Each card, list, heading and grid on the
 * page is dealt the next entrance from the deck, so neighbours never share a move, and the next
 * visit deals a different hand and a different flow. The seed is a per-route visit counter kept
 * in localStorage, so the rotation carries across reloads too.
 *
 * Everything here ends at rest (clearProps) so layout, React and accessibility are untouched.
 */

// ── the entrance library ─────────────────────────────────────────────────────────────────────────

export interface Entrance {
  name: string
  from: gsap.TweenVars
  /** Extra end values beyond "at rest" (e.g. a clip-path fully open). */
  to?: gsap.TweenVars
  ease: string
  duration: number
}

const rnd = gsap.utils.random

export const ENTRANCES: Entrance[] = [
  { name: 'rise', from: { y: 70, autoAlpha: 0 }, ease: 'power4.out', duration: 0.85 },
  { name: 'drop', from: { y: -80, autoAlpha: 0, rotation: () => rnd(-7, 7) }, ease: 'bounce.out', duration: 1.05 },
  { name: 'flip-down', from: { rotationX: -95, autoAlpha: 0, transformOrigin: '50% 0%', transformPerspective: 900 }, ease: 'back.out(1.6)', duration: 0.95 },
  { name: 'door', from: { rotationY: 95, autoAlpha: 0, transformOrigin: '0% 50%', transformPerspective: 900 }, ease: 'back.out(1.3)', duration: 0.95 },
  { name: 'pop', from: { scale: 0.35, autoAlpha: 0 }, ease: 'elastic.out(1, 0.5)', duration: 1.2 },
  { name: 'dash-left', from: { x: -140, skewX: 14, autoAlpha: 0 }, ease: 'expo.out', duration: 0.95 },
  { name: 'dash-right', from: { x: 140, skewX: -14, autoAlpha: 0 }, ease: 'expo.out', duration: 0.95 },
  { name: 'swirl', from: { rotation: -28, scale: 0.55, x: -50, autoAlpha: 0 }, ease: 'back.out(1.8)', duration: 1.05 },
  { name: 'focus', from: { filter: 'blur(20px)', scale: 1.18, autoAlpha: 0 }, to: { filter: 'blur(0px)' }, ease: 'power3.out', duration: 0.9 },
  { name: 'iris', from: { clipPath: 'circle(0% at 50% 50%)' }, to: { clipPath: 'circle(150% at 50% 50%)' }, ease: 'power3.inOut', duration: 0.95 },
  { name: 'curtain', from: { clipPath: 'inset(0% 100% 0% 0% round 14px)' }, to: { clipPath: 'inset(0% 0% 0% 0% round 14px)' }, ease: 'power4.inOut', duration: 0.95 },
  { name: 'unfold', from: { scaleY: 0, autoAlpha: 0, transformOrigin: '50% 0%' }, ease: 'expo.out', duration: 0.85 },
  { name: 'slam', from: { scale: 1.7, autoAlpha: 0 }, ease: 'power4.out', duration: 0.75 },
  { name: 'tumble', from: { rotationX: 65, rotationY: -45, y: 90, autoAlpha: 0, transformPerspective: 900 }, ease: 'back.out(1.25)', duration: 1.15 },
  { name: 'diagonal', from: { clipPath: 'polygon(0% 0%, 0% 0%, 0% 0%, 0% 0%)' }, to: { clipPath: 'polygon(0% 0%, 200% 0%, 100% 200%, 0% 100%)' }, ease: 'power3.inOut', duration: 1 },
  { name: 'spring-up', from: { y: 120, scaleY: 1.25, scaleX: 0.85, autoAlpha: 0 }, ease: 'elastic.out(1, 0.45)', duration: 1.3 },
]

/** The values every entrance lands on. */
const REST: gsap.TweenVars = { autoAlpha: 1, x: 0, y: 0, z: 0, rotation: 0, rotationX: 0, rotationY: 0, scale: 1, scaleX: 1, scaleY: 1, skewX: 0 }
const CLEAR = 'transform,opacity,visibility,filter,clipPath,transformOrigin'

/**
 * The same move, arriving from above instead of below (for content scrolled back into view):
 * vertical offsets and 3D tips flip sign, and top-anchored hinges swap to the bottom.
 */
export function mirror(e: Entrance): Entrance {
  const flip = (v: unknown) => (typeof v === 'number' ? -v : typeof v === 'function' ? (...a: unknown[]) => -(v as (...b: unknown[]) => number)(...a) : v)
  const from: gsap.TweenVars = { ...e.from }
  for (const k of ['y', 'rotationX'] as const) if (k in from) from[k] = flip(from[k]) as never
  if (typeof from.transformOrigin === 'string') from.transformOrigin = from.transformOrigin.replace(/(\S+) 0%$/, '$1 100%')
  return { ...e, name: `${e.name}-from-above`, from }
}

/** Put an element in an entrance's starting pose (hidden, ready to play). */
export function pose(el: Element | Element[], e: Entrance) {
  gsap.set(el, e.from)
}

/** Play an entrance to rest. */
export function play(el: Element | Element[], e: Entrance, vars: gsap.TweenVars = {}) {
  return gsap.to(el, { ...REST, ...e.to, duration: e.duration, ease: e.ease, overwrite: 'auto', clearProps: CLEAR, ...vars })
}

// ── flows: the order a group arrives in ──────────────────────────────────────────────────────────

export type Flow = 'cascade' | 'reverse' | 'center-out' | 'edges-in' | 'scatter' | 'sweep-x' | 'sweep-y'
export const FLOWS: Flow[] = ['cascade', 'reverse', 'center-out', 'edges-in', 'scatter', 'sweep-x', 'sweep-y']

/** Order elements for a flow (by on-screen position where that matters). */
export function order<T extends Element>(els: T[], flow: Flow, rng: () => number): T[] {
  const a = [...els]
  const box = (el: Element) => el.getBoundingClientRect()
  switch (flow) {
    case 'reverse':
      return a.reverse()
    case 'scatter':
      return shuffle(a, rng)
    case 'sweep-x':
      return a.sort((p, q) => box(p).left - box(q).left || box(p).top - box(q).top)
    case 'sweep-y':
      return a.sort((p, q) => box(q).top - box(p).top) // bottom first: a rising tide
    case 'center-out':
    case 'edges-in': {
      const cx = window.innerWidth / 2
      const cy = window.innerHeight / 2
      const d = (el: Element) => { const r = box(el); return Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy) }
      return a.sort((p, q) => (flow === 'center-out' ? d(p) - d(q) : d(q) - d(p)))
    }
    default:
      return a
  }
}

/** GSAP's own stagger origin for grids, rotated the same way. */
export const GRID_FROM: ('center' | 'start' | 'end' | 'edges' | 'random')[] = ['center', 'start', 'end', 'edges', 'random']

// ── seeded randomness ────────────────────────────────────────────────────────────────────────────

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0 }
export function shuffle<T>(a: T[], rng: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

// ── the show: one per visit to a route ───────────────────────────────────────────────────────────

export interface Show {
  path: string
  visit: number
  rng: () => number
  /** The next entrance; never the same as the one dealt just before. */
  deal: () => Entrance
  /** Pick one of a list for this visit (stable per `key` within the visit). */
  pick: <T>(key: string, options: readonly T[]) => T
  flow: Flow
}

let current: Show | null = null

/** Count this visit (once per navigation) and build its show. */
export function showFor(pathname: string): Show {
  if (current && current.path === pathname) return current
  let visit = 0
  try {
    const k = `inch-visit:${pathname}`
    visit = (parseInt(localStorage.getItem(k) ?? '0', 10) || 0) + 1
    localStorage.setItem(k, String(visit))
  } catch {
    visit = Math.floor(Math.random() * 1e6)
  }
  const rng = mulberry32(hash(pathname) ^ Math.imul(visit, 2654435761))
  let deck: Entrance[] = []
  let last: Entrance | null = null
  const deal = () => {
    if (!deck.length) {
      deck = shuffle([...ENTRANCES], rng)
      if (last && deck[deck.length - 1] === last) deck.unshift(deck.pop()!) // no repeat across the seam
    }
    last = deck.pop()!
    return last
  }
  const picks = new Map<string, unknown>()
  const pick = <T,>(key: string, options: readonly T[]): T => {
    if (!picks.has(key)) picks.set(key, options[Math.floor(rng() * options.length)])
    return picks.get(key) as T
  }
  // the flow rotates visit by visit (never the same twice running), not by chance
  const flow = FLOWS[(hash(pathname) + visit) % FLOWS.length]
  current = { path: pathname, visit, rng, deal, pick, flow }
  return current
}
