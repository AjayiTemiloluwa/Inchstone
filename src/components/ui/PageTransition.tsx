'use client'

import { motion } from 'motion/react'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

/**
 * PageTransition — springs every page in with a soft fluid rise.
 *
 * The container is keyed by pathname so client-side navigations remount it:
 * the new page rises into place (opacity + y + micro-scale, spring). Paired
 * with FluidPress's nav "sink", tapping a link squishes the old page and the
 * new one pops back into shape — one continuous liquid gesture.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <motion.div
      key={pathname}
      data-page-content
      initial={{ opacity: 0, y: 18, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 430, damping: 36, mass: 0.9 }}
    >
      {children}
    </motion.div>
  )
}