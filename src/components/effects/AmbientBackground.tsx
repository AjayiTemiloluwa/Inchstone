'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useAmbient, type Season } from './atmosphere'

/* ────────────────────────────────────────────────────────────────
   AmbientBackground — a living sky driven by a travelling sun.
   The sun rises on the RIGHT and crosses to the left through the
   daylight hours; as it travels it continuously models the light:
   the sky gradient is interpolated (not stepped) through dawn →
   morning → noon → afternoon → dusk → deep night, the glow follows
   elevation, and stars fade in as it sets. After dark the orb
   becomes the moon and makes the return crossing. A dimming veil in
   the layout keeps every UI surface readable.
   ──────────────────────────────────────────────────────────────── */

interface SkyStop {
  h: number // hour of day (float)
  top: string
  mid: string
  bottom: string
  sun: string
  glow: number // 0..1 base intensity
  stars: number
}

const STOPS: SkyStop[] = [
  { h: 0.0,  top: '#05070f', mid: '#0d1226', bottom: '#1a2242', sun: '#e8e9f2', glow: 0.30, stars: 0.55 },
  { h: 4.6,  top: '#05070f', mid: '#0d1226', bottom: '#1a2242', sun: '#e8e9f2', glow: 0.30, stars: 0.50 },
  { h: 5.8,  top: '#1a1428', mid: '#4a2f3a', bottom: '#b8745c', sun: '#f6c98e', glow: 0.45, stars: 0.18 },
  { h: 7.5,  top: '#27304a', mid: '#5f6b8a', bottom: '#b8c4d9', sun: '#ffe3a3', glow: 0.60, stars: 0.00 },
  { h: 12.0, top: '#26406a', mid: '#5f8bbf', bottom: '#cfe3f2', sun: '#fff3c4', glow: 1.00, stars: 0.00 },
  { h: 15.0, top: '#31425f', mid: '#7d92a8', bottom: '#dcc8a6', sun: '#f8dca8', glow: 0.72, stars: 0.00 },
  { h: 17.8, top: '#1c1226', mid: '#4a2640', bottom: '#c4763e', sun: '#ff9d66', glow: 0.55, stars: 0.20 },
  { h: 19.4, top: '#120b1c', mid: '#2e1830', bottom: '#5c3040', sun: '#e88a70', glow: 0.40, stars: 0.35 },
  { h: 20.8, top: '#05070f', mid: '#0d1226', bottom: '#1a2242', sun: '#e8e9f2', glow: 0.32, stars: 0.52 },
  { h: 24.0, top: '#05070f', mid: '#0d1226', bottom: '#1a2242', sun: '#e8e9f2', glow: 0.30, stars: 0.55 },
]

const SEASON_TINT: Record<Season, string> = {
  wet: 'rgba(96, 170, 170, 0.12)',   // cooler blue-green (rainy season)
  dry: 'rgba(214, 160, 90, 0.10)',   // warmer, hazier (dry season)
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v))
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const bl = Math.round(b1 + (b2 - b1) * t)
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`
}

type Pt = { id: number; left: number; top: number; size: number; delay: number; duration: number }

/* Seeded PRNG — particle fields must match between server and client. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gen(count: number, topMax: number, sizeMin: number, sizeMax: number, seed: number): Pt[] {
  const rnd = mulberry32(seed)
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: rnd() * 100,
    top: rnd() * topMax,
    size: sizeMin + rnd() * (sizeMax - sizeMin),
    delay: rnd() * 6,
    duration: 8 + rnd() * 12,
  }))
}

export function AmbientBackground() {
  const amb = useAmbient()

  const stars = useMemo(() => gen(amb.isNight ? 90 : 40, 60, 1, 2.4, 1337), [amb.isNight])
  const clouds = useMemo(() => gen(6, 55, 0.9, 1.4, 7331), [])
  const rain = useMemo(() => gen(30, 100, 1, 1, 4242), [])
  const snow = useMemo(() => gen(40, 100, 2, 4, 9090), [])

  // Touch bursts — AmbientBackground reacts to taps/drags (fired by TouchFx on
  // coarse pointers) with a fading radial glow. Reduced-motion: skip adding.
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>([])
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    const onTouch = (e: Event) => {
      const { x, y } = (e as CustomEvent).detail as { x: number; y: number }
      const id = Date.now() + Math.random()
      setBursts((b) => [
        ...b.slice(-3),
        { id, x: (x / window.innerWidth) * 100, y: (y / window.innerHeight) * 100 },
      ])
      window.setTimeout(() => setBursts((b) => b.filter((p) => p.id !== id)), 850)
    }
    window.addEventListener('inchstone:touch', onTouch)
    return () => window.removeEventListener('inchstone:touch', onTouch)
  }, [])

  /* Continuous sky — interpolate the palette at the current minute. */
  const h = amb.minuteOfDay / 60
  let lo = STOPS[0]
  let hi = STOPS[STOPS.length - 1]
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (h >= STOPS[i].h && h <= STOPS[i + 1].h) {
      lo = STOPS[i]
      hi = STOPS[i + 1]
      break
    }
  }
  const span = Math.max(hi.h - lo.h, 0.0001)
  const k = clamp01((h - lo.h) / span)

  const top = mixHex(lo.top, hi.top, k)
  const mid = mixHex(lo.mid, hi.mid, k)
  const bottom = mixHex(lo.bottom, hi.bottom, k)
  const sunColor = mixHex(lo.sun, hi.sun, k)
  const starOpacity = lo.stars + (hi.stars - lo.stars) * k

  /*
   * Orb path. Daylight (05:00→20:00): rises on the RIGHT, arcs high at
   * noon, sets on the LEFT. Night: the moon makes the same return trip.
   */
  const isDaylight = h >= 5 && h < 20
  const dayP = clamp01((h - 5) / 15)
  const nightH = h >= 20 ? h - 20 : h + 4 // 20:00→05:00 mapped to 0..9
  const nightP = clamp01(nightH / 9)

  const p = isDaylight ? dayP : nightP
  const orbLeft = 90 - p * 82
  const orbTop = (isDaylight ? 34 : 30) - Math.sin(p * Math.PI) * (isDaylight ? 26 : 21)

  // Light intensity tracks elevation — soft at the horizon, full at noon.
  const elevation = Math.sin(p * Math.PI)
  const glowAlpha = (lo.glow + (hi.glow - lo.glow) * k) * (0.35 + 0.65 * elevation)
  const orbSize = isDaylight ? 56 : 44

  /*
   * Sun / moon RAYS — brightness and reach are modelled off real light:
   *  · elevation  — the higher the orb, the fuller the ray bloom
   *  · glowAlpha  — time-of-day stops (dim at dawn/dusk, full at noon)
   *  · weatherDim — clouds, rain, haze and storms physically block the rays
   * Only the rays are tinted; the text/UI sits behind the dimming veil so
   * the writing stays perfectly readable (the request: "do not affect the
   * writeups").
   */
  let weatherDim = 1
  if (amb.isStorm) weatherDim = 0.12
  else if (amb.isRaining) weatherDim = 0.3
  else if (amb.weather === 'clouds') weatherDim = 0.5
  else if (amb.isHazy) weatherDim = 0.68

  const rayIntensity = clamp01(
    (isDaylight ? 0.18 + 0.82 * elevation : 0.10 + 0.5 * elevation) *
    (0.35 + 0.65 * glowAlpha) *
    weatherDim
  )
  const raySize = isDaylight ? orbSize * 3.5 : orbSize * 3.0

  const scene = `linear-gradient(180deg, ${top} 0%, ${mid} 55%, ${bottom} 100%)`

  return (
    <div aria-hidden="true" className="ambient-bg">
      <motion.div className="ambient-sky" animate={{ background: scene }} transition={{ duration: 2.2, ease: 'easeInOut' }} />
      <div className="ambient-layer" style={{ background: SEASON_TINT[amb.season], mixBlendMode: 'overlay' }} />

      {/* Sun by day, moon by night — one traveller, right → left */}
      <div className="ambient-layer ambient-orb-wrap" data-parallax="0.05">
        {/* Rays — brightness follows elevation + time stops + weather */}
        <div
          className={`ambient-rays ${isDaylight ? 'ambient-rays--sun' : 'ambient-rays--moon'}`}
          style={{
            left: `${orbLeft}%`,
            top: `${orbTop}%`,
            width: raySize,
            height: raySize,
            opacity: rayIntensity,
          }}
        />
        <div
          className="ambient-orb"
          style={{
            left: `${orbLeft}%`,
            top: `${orbTop}%`,
            width: orbSize,
            height: orbSize,
            background: sunColor,
            transition: 'width 1.8s ease, height 1.8s ease',
            boxShadow: `0 0 ${28 + 26 * elevation}px ${6 + 10 * elevation}px ${rgba(sunColor, 0.16 + 0.34 * glowAlpha)}, 0 0 ${70 + 60 * elevation}px ${22 + 26 * elevation}px ${rgba(sunColor, 0.08 + 0.3 * glowAlpha)}`,
          }}
        />
      </div>

      {/* Stars fade with the interpolated night level */}
      <div className="ambient-layer ambient-stars" style={{ opacity: starOpacity, transition: 'opacity 1.6s ease' }}>
        {stars.map((s) => (
          <span key={s.id} className="ambient-star" style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s`, animationDuration: `${s.duration}s` }} />
        ))}
      </div>

      {/* Drifting clouds */}
      <div className="ambient-layer">
        {clouds.map((c) => (
          <span key={c.id} className="ambient-cloud" style={{ left: `${c.left}%`, top: `${c.top}%`, opacity: amb.isNight ? 0.14 : 0.28, animationDelay: `${c.delay}s`, animationDuration: `${c.duration}s`, transform: `scale(${c.size})` }} />
        ))}
      </div>

      {/* Rain — only when rain is falling */}
      {amb.isRaining && (
        <div className="ambient-layer ambient-rain" style={{ opacity: 0.3 }}>
          {rain.map((r) => (
            <span key={r.id} className="ambient-rain-stripe" style={{ left: `${r.left}%`, top: `${r.top}%`, animationDelay: `${r.delay * 0.3}s`, animationDuration: `${0.7 + (r.id % 5) * 0.15}s` }} />
          ))}
        </div>
      )}

      {/* Snow when snowing */}
      {amb.isSnowing && (
        <div className="ambient-layer" style={{ opacity: 0.5 }}>
          {snow.map((s) => (
            <span key={s.id} className="ambient-snow" style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s`, animationDuration: `${s.duration}s` }} />
          ))}
        </div>
      )}

      {/* Harmattan / dusty haze — faint warm veil during dry-season haze */}
      {amb.isHazy && (
        <div className="ambient-layer ambient-haze" style={{ opacity: 0.5 }} />
      )}

      {/* Thunderstorm — occasional lightning flash over the rain */}
      {amb.isStorm && (
        <div className="ambient-layer ambient-flash" aria-hidden="true" />
      )}

      {/* Touch-reactive glow bursts (mobile) — soft gold blooms where tapped/dragged */}
      {bursts.length > 0 && (
        <div className="ambient-layer">
          {bursts.map((b) => (
            <span
              key={b.id}
              className="ambient-touch-glow"
              style={{ left: `${b.x}%`, top: `${b.y}%` }}
            />
          ))}
        </div>
      )}
    </div>
  )
}