'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

/* ────────────────────────────────────────────────────────────────
   Atmosphere engine — Inchstone's living backdrop.
   Resolves, from the local clock + month + a keyless weather lookup:
     · timeOfDay : dawn / morning / noon / afternoon / dusk / night
     · season    : spring / summer / autumn / winter
     · weather   : clear / clouds / rain / snow   (Open-Meteo, cached)
   Exposes an `ambient` descriptor so every other component (ambient
   background, text reveals, the game loader) can react differently at
   different times of day / seasons / weather.
   ──────────────────────────────────────────────────────────────── */

export type TimeOfDay = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'dusk' | 'night'
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'
export type Weather = 'clear' | 'clouds' | 'rain' | 'snow'

export interface Ambient {
  timeOfDay: TimeOfDay
  season: Season
  weather: Weather
  isNight: boolean
  isRaining: boolean
  isSnowing: boolean
  isSpring: boolean
  isSummer: boolean
  isAutumn: boolean
  isWinter: boolean
  hour: number
  month: number
  /** Remaining daylight fraction 0..1 (used for sun/moon placement). */
  daylight: number
  /** Reactive "feel" descriptor — text/loader/particles read this. */
  motion: {
    revealY: number
    revealDuration: number
    stagger: number
    blur: number
    warmth: number // -1 (cold/night) .. +1 (warm/noon)
    accent: string // a tailwind text color for the "reaction" tint
  }
}

export function timeOfDayFromHour(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 7) return 'dawn'
  if (hour >= 7 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 14) return 'noon'
  if (hour >= 14 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 20) return 'dusk'
  return 'night'
}

export function seasonFromMonth(month: number): Season {
  if (month >= 2 && month <= 4) return 'spring'
  if (month >= 5 && month <= 7) return 'summer'
  if (month >= 8 && month <= 10) return 'autumn'
  return 'winter'
}

function weatherFromCode(code: number): Weather {
  if (code === 0 || code === 1) return 'clear'
  if (code === 2 || code === 3) return 'clouds'
  if (code >= 71 && code <= 77) return 'snow'
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 99)) return 'rain'
  return 'clear'
}

/* ── Per-atmosphere "feel" — text reacts differently at different times ── */
function motionFor(t: TimeOfDay, weather: Weather): Ambient['motion'] {
  switch (t) {
    case 'dawn':
      return { revealY: 18, revealDuration: 0.85, stagger: 42, blur: 6, warmth: 0.2, accent: 'text-gold' }
    case 'morning':
      return { revealY: 22, revealDuration: 0.6, stagger: 34, blur: 5, warmth: 0.5, accent: 'text-gold' }
    case 'noon':
      return { revealY: 26, revealDuration: 0.5, stagger: 26, blur: 4, warmth: 1, accent: 'text-gold-glow' }
    case 'afternoon':
      return { revealY: 20, revealDuration: 0.7, stagger: 40, blur: 6, warmth: 0.6, accent: 'text-gold' }
    case 'dusk':
      return { revealY: 16, revealDuration: 0.9, stagger: 50, blur: 8, warmth: 0.1, accent: 'text-ember' }
    case 'night':
      return { revealY: 12, revealDuration: 1.1, stagger: 60, blur: 10, warmth: -1, accent: 'text-parchment/70' }
    default:
      return { revealY: 18, revealDuration: 0.7, stagger: 40, blur: 6, warmth: 0.3, accent: 'text-gold' }
  }
}

const CACHE_KEY = 'inchstone-atmosphere'

/**
 * Used for the very first server AND client render so both match exactly
 * (React hydration requires byte-identical markup). Swapped for the real
 * local clock immediately after mount — the 2.2s sky crossfade makes the
 * swap feel intentional rather than like a flash.
 */
const FALLBACK_NOW = new Date(2026, 5, 15, 12, 0, 0)

interface AtmosphereCtx {
  ambient: Ambient
}

const Ctx = createContext<AtmosphereCtx>({ ambient: emptyAmbient() })

function emptyAmbient(): Ambient {
  const now = FALLBACK_NOW
  const hour = now.getHours()
  const month = now.getMonth()
  const tod = timeOfDayFromHour(hour)
  const season = seasonFromMonth(month)
  return {
    timeOfDay: tod,
    season,
    weather: 'clear',
    isNight: tod === 'night',
    isRaining: false,
    isSnowing: false,
    isSpring: season === 'spring',
    isSummer: season === 'summer',
    isAutumn: season === 'autumn',
    isWinter: season === 'winter',
    hour,
    month,
    daylight: daylightFor(hour),
    motion: motionFor(tod, 'clear'),
  }
}
export function AtmosphereProvider({ children }: { children: ReactNode }) {
  // Starts on the deterministic FALLBACK_NOW (identical on server + client),
  // then adopts the real local clock in an effect — never during render.
  const [now, setNow] = useState<Date>(() => FALLBACK_NOW)
  const [weather, setWeather] = useState<Weather>('clear')

  // Adopt the real clock, and tick every minute so the background rolls over.
  useEffect(() => {
    setNow(new Date())
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  // Keyless weather lookup (Open-Meteo) via geolocation; cached for 10 min.
  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed && parsed.ts && Date.now() - parsed.ts < 600_000) {
          setWeather(parsed.weather as Weather)
          return
        }
      }
    } catch { /* ignore */ }

    const fallback = () => setWeather('clear')
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) { fallback(); return }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(2)}&longitude=${longitude.toFixed(2)}&current=weather_code&timezone=auto`,
        )
          .then((r) => r.json())
          .then((d) => {
            if (cancelled) return
            const w = weatherFromCode(Number(d?.current?.weather_code))
            setWeather(w)
            try {
              localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), weather: w }))
            } catch { /* ignore */ }
          })
          .catch(fallback)
      },
      fallback,
      { timeout: 5000 },
    )

    return () => { cancelled = true }
  }, [])

  const ambient = useMemo<Ambient>(() => {
    const hour = now.getHours()
    const month = now.getMonth()
    const tod = timeOfDayFromHour(hour)
    const season = seasonFromMonth(month)
    return {
      timeOfDay: tod,
      season,
      weather,
      isNight: tod === 'night' || tod === 'dawn' || tod === 'dusk',
      isRaining: weather === 'rain',
      isSnowing: weather === 'snow',
      isSpring: season === 'spring',
      isSummer: season === 'summer',
      isAutumn: season === 'autumn',
      isWinter: season === 'winter',
      hour,
      month,
      daylight: daylightFor(hour),
      motion: motionFor(tod, weather),
    }
  }, [now, weather])

  return <Ctx.Provider value={{ ambient }}>{children}</Ctx.Provider>
}

export function useAtmosphere(): AtmosphereCtx {
  return useContext(Ctx)
}

export function useAmbient(): Ambient {
  return useAtmosphere().ambient
}

function daylightFor(hour: number): number {
  // Rough bell curve peaking at noon (12..14), 0 at night.
  if (hour >= 5 && hour <= 20) {
    return 1 - Math.abs(hour - 12.5) / 8
  }
  return 0
}
