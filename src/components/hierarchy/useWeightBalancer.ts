'use client'

import { useState } from 'react'
import { useHierarchyStore, type Item } from '@/stores/hierarchyStore'
import { equalWeight } from './itemTree'

/**
 * Locked-weight balancing for a list of sibling items: dragging one slider
 * locks it and redistributes the remainder over the unlocked siblings.
 * Local `overrides` shadow the stored weights until cleared.
 */
export function useWeightBalancer(siblings: Item[]) {
  const updateItem = useHierarchyStore(s => s.updateItem)
  const updateItemScoreMode = useHierarchyStore(s => s.updateItemScoreMode)
  const [locked, setLocked] = useState<Record<string, boolean>>({})
  const [overrides, setOverrides] = useState<Record<string, number>>({})

  const weightOf = (item: Item) => overrides[item.id] ?? item.weight ?? 0
  const totalWeight = siblings.reduce((s, m) => s + weightOf(m), 0)

  const changeWeight = (id: string, value: number) => {
    const weights: Record<string, number> = {}
    siblings.forEach(m => { weights[m.id] = weightOf(m) })
    weights[id] = value
    const newLocked = { ...locked, [id]: true }
    setLocked(newLocked)

    const lockedSum = Object.entries(weights)
      .filter(([k]) => newLocked[k])
      .reduce((sum, [, w]) => sum + w, 0)
    if (lockedSum > 100) return

    const unlockedIds = siblings.filter(m => !newLocked[m.id]).map(m => m.id)
    const per = unlockedIds.length > 0 ? (100 - lockedSum) / unlockedIds.length : 0
    unlockedIds.forEach(k => { weights[k] = Math.round(per * 10) / 10 })

    setOverrides(weights)
    Object.entries(weights).forEach(([k, w]) => updateItem(k, { weight: w }))
  }

  const changeScore = (id: string, score: number) => {
    void updateItemScoreMode(id, 'manual', score)
  }

  const resetWeights = () => {
    if (siblings.length === 0) return
    const equal = equalWeight(siblings.length)
    const weights: Record<string, number> = {}
    siblings.forEach(m => { weights[m.id] = equal })
    setOverrides(weights)
    setLocked({})
    Object.entries(weights).forEach(([k, w]) => updateItem(k, { weight: w }))
  }

  const resetScores = () => {
    siblings.forEach(m => { void updateItemScoreMode(m.id, 'auto') })
  }

  const toggleLock = (id: string) => setLocked(prev => ({ ...prev, [id]: !prev[id] }))
  /** Forget local overrides (after siblings were added or removed). */
  const clearOverrides = () => setOverrides({})

  return { locked, weightOf, totalWeight, changeWeight, changeScore, resetWeights, resetScores, toggleLock, clearOverrides }
}
