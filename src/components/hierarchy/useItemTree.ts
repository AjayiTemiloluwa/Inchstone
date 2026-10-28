'use client'

import { useCallback, useEffect, useState } from 'react'
import { useHierarchyStore } from '@/stores/hierarchyStore'
import { buildItemTree, type RawItem } from './itemTree'

/**
 * Loads /api/items into the hierarchy store on mount and exposes a
 * `fetchItems` to refresh after a mutation.
 */
export function useItemTree() {
  const setItems = useHierarchyStore(s => s.setItems)
  const [loading, setLoading] = useState(true)

  const fetchItems = useCallback(async () => {
    const res = await fetch('/api/items', { cache: 'no-store' })
    const data: { items?: RawItem[] } = await res.json()
    if (data.items) setItems(buildItemTree(data.items))
    return data.items
  }, [setItems])

  useEffect(() => {
    let cancelled = false
    fetchItems()
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [fetchItems])

  return { loading, fetchItems }
}
