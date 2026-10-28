'use client'

import { useCallback, useRef, useState } from 'react'
import { useHierarchyStore } from '@/stores/hierarchyStore'

/**
 * Local reflection text with an 800ms debounced save to the item.
 * Seeded from `initial` on mount (remount with a `key` to reseed).
 */
export function useReflectionDraft(itemId: string | null | undefined, initial: string | null | undefined) {
  const updateItem = useHierarchyStore(s => s.updateItem)
  const [text, setText] = useState(initial ?? '')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const change = useCallback((value: string) => {
    setText(value)
    if (!itemId) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { updateItem(itemId, { reflection: value }) }, 800)
  }, [itemId, updateItem])

  return { text, change }
}
