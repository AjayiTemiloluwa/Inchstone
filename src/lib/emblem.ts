'use client'

import { Anchor, Compass, Crown, Feather, Flame, Gem, Moon, Mountain, Rocket, Sprout, Star, Sun, Swords, Target, Trophy, Zap, type LucideIcon } from 'lucide-react'
import { useSyncExternalStore } from 'react'

/**
 * Emblem — the icon a user picks to stand for them (first-run Welcome, or
 * Settings → Appearance). It sits at the heart of the Momentum chip, so your
 * level ring always carries your own mark. Kept per device in localStorage.
 */

export const EMBLEM_STORAGE_KEY = 'inchstone-emblem'
const EMBLEM_EVENT = 'inchstone:emblem'

export type EmblemId =
  | 'flame' | 'rocket' | 'mountain' | 'crown' | 'zap' | 'star' | 'compass' | 'sprout'
  | 'target' | 'gem' | 'sun' | 'moon' | 'feather' | 'anchor' | 'trophy' | 'swords'

export const EMBLEMS: { id: EmblemId; label: string; Icon: LucideIcon }[] = [
  { id: 'flame', label: 'Flame', Icon: Flame },
  { id: 'rocket', label: 'Rocket', Icon: Rocket },
  { id: 'mountain', label: 'Summit', Icon: Mountain },
  { id: 'crown', label: 'Crown', Icon: Crown },
  { id: 'zap', label: 'Bolt', Icon: Zap },
  { id: 'star', label: 'Star', Icon: Star },
  { id: 'compass', label: 'Compass', Icon: Compass },
  { id: 'sprout', label: 'Sprout', Icon: Sprout },
  { id: 'target', label: 'Target', Icon: Target },
  { id: 'gem', label: 'Gem', Icon: Gem },
  { id: 'sun', label: 'Sun', Icon: Sun },
  { id: 'moon', label: 'Moon', Icon: Moon },
  { id: 'feather', label: 'Feather', Icon: Feather },
  { id: 'anchor', label: 'Anchor', Icon: Anchor },
  { id: 'trophy', label: 'Trophy', Icon: Trophy },
  { id: 'swords', label: 'Swords', Icon: Swords },
]

export const DEFAULT_EMBLEM: EmblemId = 'flame'

function read(): EmblemId {
  try {
    const v = window.localStorage.getItem(EMBLEM_STORAGE_KEY)
    return EMBLEMS.some((e) => e.id === v) ? (v as EmblemId) : DEFAULT_EMBLEM
  } catch {
    return DEFAULT_EMBLEM
  }
}

export function setEmblem(id: EmblemId) {
  try {
    window.localStorage.setItem(EMBLEM_STORAGE_KEY, id)
  } catch {
    /* storage blocked — still update this visit */
  }
  window.dispatchEvent(new Event(EMBLEM_EVENT))
}

const subscribe = (cb: () => void) => {
  window.addEventListener(EMBLEM_EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EMBLEM_EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

/** The chosen emblem, live (re-renders when it changes anywhere). */
export function useEmblem() {
  const id = useSyncExternalStore(subscribe, read, () => DEFAULT_EMBLEM)
  return EMBLEMS.find((e) => e.id === id) ?? EMBLEMS[0]
}
