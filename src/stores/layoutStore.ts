'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Desktop sidebar state, shared by the Sidebar and the Topbar toggle and
 * remembered across visits.
 *   hidden    — the sidebar is closed entirely (content takes the full width)
 *   collapsed — the sidebar is open as a 72px icon rail
 */
interface LayoutState {
  hidden: boolean
  collapsed: boolean
  toggleHidden: () => void
  setCollapsed: (v: boolean) => void
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      hidden: false,
      collapsed: false,
      toggleHidden: () => set((s) => ({ hidden: !s.hidden })),
      setCollapsed: (collapsed) => set({ collapsed }),
    }),
    // Read after mount (Sidebar calls rehydrate) so server and client first render agree.
    { name: 'inchstone-layout', skipHydration: true },
  ),
)
