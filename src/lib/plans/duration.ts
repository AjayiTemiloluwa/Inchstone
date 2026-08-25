// Month-key ("YYYY-MM") math for Long-Term Plans: span text, quick picks,
// cadence adaptation and Gantt axis granularity (spec §2 & §6).
import { addMonths, differenceInCalendarMonths, format } from 'date-fns'
import type { ReviewCadence } from './types'

const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export function isMonthKey(v: unknown): v is string {
  return typeof v === 'string' && MONTH_KEY_RE.test(v)
}

/** "2026-08" -> Date at local midnight of the 1st */
export function parseMonthKey(key: string): Date {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1)
}

export function toMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function addMonthsToKey(key: string, n: number): string {
  return toMonthKey(addMonths(parseMonthKey(key), n))
}

/** Whole months between keys (Aug 2026 -> Aug 2033 = 84). Negative if end < start. */
export function spanMonths(startKey: string, endKey: string): number {
  return differenceInCalendarMonths(parseMonthKey(endKey), parseMonthKey(startKey))
}

export function isValidMonthRange(startKey: string, endKey: string): boolean {
  return isMonthKey(startKey) && isMonthKey(endKey) && spanMonths(startKey, endKey) >= 0
}

/** Friendly span text: "7 years, 0 months" · "3 months" · "1 month" */
export function formatSpan(startKey: string, endKey: string): string {
  if (!isValidMonthRange(startKey, endKey)) return '—'
  const total = spanMonths(startKey, endKey)
  if (total === 0) return '1 month'
  const years = Math.floor(total / 12)
  const months = total % 12
  const parts: string[] = []
  if (years > 0) parts.push(`${years} ${years === 1 ? 'year' : 'years'}`)
  if (months > 0 || years === 0) parts.push(`${months} ${months === 1 ? 'month' : 'months'}`)
  return parts.join(', ')
}

export interface QuickPick {
  label: string
  months: number
}

export const QUICK_PICKS: QuickPick[] = [
  { label: '1 month', months: 1 },
  { label: '3 months', months: 3 },
  { label: '1 year', months: 12 },
  { label: '5 years', months: 60 },
  { label: '10 years', months: 120 },
  { label: '20 years', months: 240 },
]

/** End month so the inclusive span equals `months` starting at `startKey` */
export function endFromQuickPick(startKey: string, months: number): string {
  return addMonthsToKey(startKey, months - 1)
}

/**
 * Cadence options appropriate to plan length — never offers a cadence whose
 * period can't occur at least once inside the span (no annual reviews on a
 * 1-month plan).
 */
export function cadenceOptionsForSpan(
  startKey: string,
  endKey: string
): { value: ReviewCadence; label: string }[] {
  const total = Math.max(0, spanMonths(startKey, endKey)) + 1 // inclusive months
  const opts: { value: ReviewCadence; label: string }[] = [{ value: 'weekly', label: 'Weekly' }]
  if (total >= 2) opts.push({ value: 'monthly', label: 'Monthly' })
  if (total >= 4) opts.push({ value: 'quarterly', label: 'Quarterly' })
  if (total >= 7) opts.push({ value: 'biannual', label: 'Biannual' })
  if (total >= 13) opts.push({ value: 'annual', label: 'Annual' })
  return opts
}

export type AxisGranularity = 'day' | 'month' | 'quarter'

/** Axis ticks adapt to plan length: days ≤2 months, months ≤~2 years, quarters beyond */
export function axisGranularity(startKey: string, endKey: string): AxisGranularity {
  const total = spanMonths(startKey, endKey) + 1
  if (total <= 2) return 'day'
  if (total <= 26) return 'month'
  return 'quarter'
}

export function formatMonthKey(key: string): string {
  return format(parseMonthKey(key), 'MMM yyyy')
}

export function formatMonthRange(startKey: string, endKey: string): string {
  return `${formatMonthKey(startKey)} → ${formatMonthKey(endKey)}`
}