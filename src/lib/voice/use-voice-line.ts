'use client'

import { useEffect, useState } from 'react'
import { useAmbient } from '@/components/effects/atmosphere'
import type { VoiceKey } from './types'
import { deterministicVoiceLine, pickVoiceLine } from './pick'

/**
 * useVoiceLine(key) — one hook for any recurring copy surface.
 *
 * Resolves "what time is it" from the atmosphere engine (single source of
 * truth shared by loaders, backgrounds and copy), picks a band-specific (or
 * `any`) line, and guarantees no immediate repeat per key.
 *
 * Hydration-safe: the initial render shows a deterministic line (band[0] /
 * any[0]) identical on server and client; after mount an effect upgrades it to
 * a random, no-repeat pick in the current time band.
 */
export function useVoiceLine(key: VoiceKey): string {
  const amb = useAmbient()
  const [line, setLine] = useState<string>(() => deterministicVoiceLine(key, amb.timeOfDay))

  useEffect(() => {
    // Upgrade the hydration-safe deterministic line to a random, no-repeat
    // pick after mount. Deferred (setTimeout) so this is an async update,
    // not a synchronous setState cascade in the effect pass.
    const t = window.setTimeout(() => {
      setLine(pickVoiceLine(key, amb.timeOfDay))
    }, 0)
    return () => window.clearTimeout(t)
  }, [key, amb.timeOfDay])

  return line
}