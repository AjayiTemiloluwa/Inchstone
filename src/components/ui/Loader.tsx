'use client'

import { GamifiedLoader } from '@/components/effects/GamifiedLoader'

/**
 * Fun, gamified loading state used across every page.
 * A pixel hero sprints along a track collecting coins while a blocky
 * progress bar fills with a counting percent and fun mono micro-copy.
 * Same API as before ({ label, compact }) so every page upgrades at once.
 */
export function Loader({ label = '', compact = false }: { label?: string; compact?: boolean }) {
  return <GamifiedLoader label={label} compact={compact} />
}