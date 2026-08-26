'use client'

import { useMemo } from 'react'
import { motion } from 'motion/react'
import { useAmbient, type TimeOfDay, type Season } from './atmosphere'

interface Sky {
  top: string
  mid: string
  bottom: string
  sun: string
  sunGlow: string
  starOpacity: number
}

const SKIES: Record<TimeOfDay, Sky> = {
  dawn: { top: '#1a1428', mid: '#4a2f3a', bottom: '#b8745c', sun: '#f6c98e', sunGlow: 'rgba(246, 201, 142, 0.5)', starOpacity: 0.18 },
  morning: { top: '#27304a', mid: '#5f6b8a', bottom: '#b8c4d9', sun: '#ffe3a3', sunGlow: 'rgba(255, 227, 163, 0.45)', starOpacity: 0 },
  noon: { top: '#26406a', mid: '#5f8bbf', bottom: '#cfe3f2', sun: '#fff3c4', sunGlow: 'rgba(255, 243, 196, 0.55)', starOpacity: 0 },
  afternoon: { top: '#31425f', mid: '#7d92a8', bottom: '#dcc8a6', sun: '#f8dca8', sunGlow: 'rgba(248, 220, 168, 0.4)', starOpacity: 0 },
  dusk: { top: '#1c1226', mid: '#4a2640', bottom: '#c4763e', sun: '#ff9d66', sunGlow: 'rgba(255, 157, 102, 0.5)', starOpacity: 0.32 },
  night: { top: '#05070f', mid: '#0d1226', bottom: '#1a2242', sun: '#e8e9f2', sunGlow: 'rgba(232, 233, 242, 0.28)', starOpacity: 0.55 },
}

const SEASON_TINT: Record<Season, string> = {
  spring: 'rgba(120, 190, 150, 0.10)',
  summer: 'rgba(255, 214, 130, 0.10)',
  autumn: 'rgba(214, 124, 62, 0.14)',
  winter: 'rgba(170, 195, 230, 0.12)',
}

const LEAF_COLORS = ['#b87333', '#c19a3f', '#a3522f', '#8f6b31']

type Pt = { id: number; left: number; top: number; size: number; delay: number; duration: number }

/**
 * Seeded PRNG (mulberry32). Particle positions are rendered into SSR'd HTML,
 * so they MUST be identical on the server and the client's first render —
 * Math.random() would throw a hydration mismatch on every star/cloud/drop.
 */
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
  const sky = SKIES[amb.timeOfDay]

  const stars = useMemo(() => gen(amb.isNight ? 90 : 40, 60, 1, 2.4, 1337), [amb.isNight])
  const clouds = useMemo(() => gen(6, 55, 0.9, 1.4, 7331), [])
  const rain = useMemo(() => gen(30, 100, 1, 1, 4242), [])
  const snow = useMemo(() => gen(40, 100, 2, 4, 9090), [])
  const leaves = useMemo(() => gen(16, 100, 6, 11, 5150), [])

  const sunLeft = 6 + amb.daylight * 88
  const sunTop = 12 + (1 - amb.daylight) * 18
  const scene = `linear-gradient(180deg, ${sky.top} 0%, ${sky.mid} 55%, ${sky.bottom} 100%)`

  return (
    <div aria-hidden="true" className="ambient-bg">
      <motion.div className="ambient-sky" animate={{ background: scene }} transition={{ duration: 2.2, ease: 'easeInOut' }} />
      <div className="ambient-layer" style={{ background: SEASON_TINT[amb.season], mixBlendMode: 'overlay' }} />

      {/* Sun / moon */}
      <div className="ambient-layer ambient-orb-wrap" data-parallax="0.05">
        <div
          className="ambient-orb"
          style={{
            left: `${sunLeft}%`,
            top: `${sunTop}%`,
            background: sky.sun,
            boxShadow: `0 0 28px 6px ${sky.sunGlow}, 0 0 70px 22px ${sky.sunGlow}`,
          }}
        />
      </div>

      {/* Stars fade in at night */}
      <div className="ambient-layer ambient-stars" style={{ opacity: sky.starOpacity, transition: 'opacity 1.6s ease' }}>
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

      {/* Autumn leaves drifting down */}
      {amb.isAutumn && (
        <div className="ambient-layer" style={{ opacity: 0.55 }}>
          {leaves.map((l) => (
            <span key={l.id} className="ambient-leaf" style={{ left: `${l.left}%`, top: `${l.top}%`, width: l.size, height: l.size * 0.7, background: LEAF_COLORS[l.id % LEAF_COLORS.length], animationDelay: `${l.delay}s`, animationDuration: `${l.duration}s` }} />
          ))}
        </div>
      )}
    </div>
  )
}
