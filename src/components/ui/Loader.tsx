'use client'

import { GamifiedLoader } from '@/components/effects/GamifiedLoader'
import type { LoaderRouteKey } from '@/components/effects/GamifiedLoader'

/**
 * Fun, gamified loading state used across every page.
 * A pixel hero sprints along a track collecting coins while a blocky
 * progress bar fills with a counting percent and fun mono micro-copy.
 * Same API as before ({ label, compact }) plus an optional routeKey that
 * makes the micro-copy contextual and time-of-day aware via the voice bank.
 */
export function Loader({
  label = '',
  compact = false,
  routeKey,
}: {
  label?: string
  compact?: boolean
  routeKey?: LoaderRouteKey
}) {
  return <GamifiedLoader label={label} compact={compact} routeKey={routeKey} />
}