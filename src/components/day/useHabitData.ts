'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { eachDayOfInterval, format, parseISO, startOfDay } from 'date-fns'
import type { Task } from '@/stores/hierarchyStore'
import type { GraphRange, HabitDetail, HabitHistoryEntry, HabitOverviewEntry } from './types'

const SERIES_DAYS = 30

/**
 * Everything the habit tracker needs from the API for one day: today's habit
 * tasks, the habit definitions (incl. off-day ones), and the completion
 * history that feeds the sparklines, per-habit detail and the trend graph.
 */
export function useHabitData(dateStr: string) {
  const [todayHabits, setTodayHabits] = useState<Task[]>([])
  const [habitOverview, setHabitOverview] = useState<HabitOverviewEntry[]>([])
  const [habitHistory, setHabitHistory] = useState<HabitHistoryEntry[]>([])
  const [range, setRange] = useState<GraphRange>('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const loadTodayHabits = useCallback(async (): Promise<Task[] | null> => {
    try {
      const res = await fetch(`/api/tasks?date=${dateStr}&habit=true`)
      if (!res.ok) return null
      const data = await res.json()
      return ((data.tasks || []) as Task[]).filter(t => t.isHabit)
    } catch (e) {
      console.error('Failed to fetch today habits', e)
      return null
    }
  }, [dateStr])
  const fetchTodayHabits = useCallback(async () => {
    const habits = await loadTodayHabits()
    if (habits) setTodayHabits(habits)
  }, [loadTodayHabits])

  const loadHabitOverview = useCallback(async (): Promise<HabitOverviewEntry[] | null> => {
    try {
      const res = await fetch(`/api/habits/overview?date=${dateStr}`)
      if (!res.ok) return null
      const data = await res.json()
      return data.habits || []
    } catch (e) {
      console.error('Failed to fetch habit overview', e)
      return null
    }
  }, [dateStr])
  const fetchHabitOverview = useCallback(async () => {
    const habits = await loadHabitOverview()
    if (habits) setHabitOverview(habits)
  }, [loadHabitOverview])

  const loadHabitHistory = useCallback(async (): Promise<HabitHistoryEntry[] | null> => {
    try {
      let url = '/api/habits?range=year'
      if (range === 'week') url = '/api/habits?range=week'
      else if (range === 'month') url = '/api/habits?range=month'
      else if (range === 'year') url = '/api/habits?range=year'
      else if (range === 'all') {
        const res = await fetch('/api/habits?t=' + Date.now())
        if (!res.ok) return null
        const data = await res.json()
        return data.habits || []
      } else if (range === 'custom' && customStart && customEnd) {
        url = `/api/habits?start=${customStart}&end=${customEnd}`
      }

      const res = await fetch(url)
      if (!res.ok) return null
      const data = await res.json()
      return data.habits || []
    } catch (e) {
      console.error('Failed to fetch habit history', e)
      return null
    }
  }, [range, customStart, customEnd])
  const fetchHabitHistory = useCallback(async () => {
    const habits = await loadHabitHistory()
    if (habits) setHabitHistory(habits)
  }, [loadHabitHistory])

  useEffect(() => {
    let cancelled = false
    loadTodayHabits().then(h => { if (!cancelled && h) setTodayHabits(h) })
    return () => { cancelled = true }
  }, [loadTodayHabits])

  useEffect(() => {
    let cancelled = false
    loadHabitOverview().then(h => { if (!cancelled && h) setHabitOverview(h) })
    return () => { cancelled = true }
  }, [loadHabitOverview])

  useEffect(() => {
    let cancelled = false
    loadHabitHistory().then(h => { if (!cancelled && h) setHabitHistory(h) })
    return () => { cancelled = true }
  }, [loadHabitHistory, dateStr])

  // Last-30-day completion series per habit title — feeds the inline sparklines.
  const habitSeriesByTitle = useMemo(() => {
    const map: Record<string, boolean[]> = {}
    const seriesStart = parseISO(dateStr)
    seriesStart.setDate(seriesStart.getDate() - (SERIES_DAYS - 1))
    seriesStart.setHours(0, 0, 0, 0)
    for (const h of habitHistory) {
      const d = new Date(h.date)
      const idx = Math.floor((d.getTime() - seriesStart.getTime()) / 86_400_000)
      if (idx < 0 || idx >= SERIES_DAYS) continue
      if (!map[h.title]) map[h.title] = Array(SERIES_DAYS).fill(false)
      if (h.completed) map[h.title][idx] = true
    }
    return map
  }, [habitHistory, dateStr])

  // Per-habit detail (last-30-days list, streak, rate) — feeds the expandable row.
  const habitDetail = useMemo(() => {
    const out: Record<string, HabitDetail> = {}
    const currentDate = parseISO(dateStr)
    const titles = [...new Set(habitHistory.map(h => h.title))]
    const seriesStart = new Date(currentDate)
    seriesStart.setDate(seriesStart.getDate() - (SERIES_DAYS - 1))
    seriesStart.setHours(0, 0, 0, 0)
    for (const title of titles) {
      const inst = habitHistory.filter(h => h.title === title)
      const doneSet = new Set(
        inst.filter(h => h.completed).map(h => format(parseISO(h.date), 'yyyy-MM-dd')),
      )
      const dayList = eachDayOfInterval({ start: seriesStart, end: startOfDay(currentDate) }).map(d => ({
        date: d,
        done: doneSet.has(format(d, 'yyyy-MM-dd')),
      }))
      let streak = 0
      for (let i = dayList.length - 1; i >= 0; i--) {
        if (dayList[i].done) streak++
        else break
      }
      const total = inst.length
      const done = inst.filter(h => h.completed).length
      out[title] = { days: dayList, streak, rate: total > 0 ? Math.round((done / total) * 100) : 0, total, done }
    }
    return out
  }, [habitHistory, dateStr])

  return {
    todayHabits,
    setTodayHabits,
    habitOverview,
    habitHistory,
    range,
    setRange,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    fetchTodayHabits,
    fetchHabitOverview,
    fetchHabitHistory,
    habitSeriesByTitle,
    habitDetail,
  }
}
