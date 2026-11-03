// The money rules of Inchstone, as pure functions (no database), so they can be tested to death.
//
// Model: a LEDGER of immutable entries, in the style of double-entry bookkeeping.
//   · Purses are accounts that hold real money. Net worth = the sum of all purses.
//   · income        → money enters the system (always lands in Main)
//   · expense       → money leaves the system, from the purse it is spent from; tagged with the
//                     envelope (Need / Want / Offerings / Savings) it belongs to
//   · transfer_out / transfer_in → money moves between purses. They only ever exist as a PAIR of
//                     equal amounts sharing a groupId, so a transfer can never create or destroy money.
//   · Nothing is deleted: a mistake is VOIDED (kept for the audit trail, excluded from balances).
//
// Invariants the service enforces on EVERY write by replaying the whole ledger in date order:
//   I1  no purse balance is ever below zero, at any point in time (so backdating, voiding or editing
//       can never "spend" money that was not there yet)
//   I2  every transfer group has equal money out and in
//   I3  all money is whole kobo (2 decimals), positive, and below a sane ceiling
//   I4  income only lands in Main; transfers join two different live purses
//
// Money is compared in integer kobo, never in floats, so 0.1 + 0.2 can never open a 1-kobo hole.

export const SECTIONS = ['Need', 'Want', 'Offerings', 'Savings'] as const
export type SectionName = (typeof SECTIONS)[number]

export type EntryType = 'income' | 'expense' | 'transfer_in' | 'transfer_out'

/** Categories only the system may use (transfers and envelope funding), never a typed-in income/expense. */
export const RESERVED_CATEGORIES = ['transfer', 'allocation']

/** ₦1 trillion: beyond this an amount is a typo or an attack, not money. */
export const MAX_KOBO = 1_000_000_000_000 * 100
export const MAIN = 'Main'
export const CURRENCY = 'NGN'

export interface LedgerEntry {
  id?: string
  type: EntryType | string
  /** Naira (what the database stores); converted to kobo for every comparison. */
  amount: number
  purse: string
  entryDate: Date | string
  createdAt?: Date | string | null
  voidedAt?: Date | string | null
  groupId?: string | null
  allocationId?: string | null
}

export const toKobo = (naira: number) => Math.round(naira * 100)
export const fromKobo = (kobo: number) => kobo / 100
const ms = (d: Date | string | null | undefined) => (d ? new Date(d).getTime() : 0)

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

/** A positive amount in naira with at most 2 decimals, below the ceiling. Accepts numbers and numeric strings. */
export function parseAmount(raw: unknown): Parsed<number> {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw.replace(/,/g, '').trim()) : NaN
  if (!Number.isFinite(n)) return { ok: false, error: 'Enter an amount, for example 2500 or 2500.50.' }
  if (n <= 0) return { ok: false, error: 'The amount must be more than zero.' }
  const kobo = toKobo(n)
  if (Math.abs(n * 100 - kobo) > 1e-6) return { ok: false, error: 'Use at most 2 decimal places (kobo).' }
  if (kobo > MAX_KOBO) return { ok: false, error: 'That amount is too large to be real. Check for an extra zero.' }
  return { ok: true, value: fromKobo(kobo) }
}

/** A day an entry may be dated: not before 2000 and not later than tomorrow (time-zone slack), never in the future beyond that. */
export function parseEntryDate(raw: unknown, now: Date = new Date()): Parsed<Date> {
  const d = raw ? new Date(raw as string) : now
  if (Number.isNaN(d.getTime())) return { ok: false, error: 'That date is not valid.' }
  if (d.getTime() < Date.UTC(2000, 0, 1)) return { ok: false, error: 'Dates before the year 2000 are not accepted.' }
  if (d.getTime() > now.getTime() + 36 * 3_600_000) return { ok: false, error: 'You cannot record money on a future date. Record it on the day it happens.' }
  return { ok: true, value: d }
}

export function parseText(raw: unknown, label: string, max: number, required = false): Parsed<string | null> {
  if (raw === undefined || raw === null || (typeof raw === 'string' && !raw.trim())) {
    return required ? { ok: false, error: `${label} is required.` } : { ok: true, value: null }
  }
  if (typeof raw !== 'string') return { ok: false, error: `${label} must be text.` }
  const t = raw.trim()
  if (t.length > max) return { ok: false, error: `${label} is too long (max ${max} characters).` }
  return { ok: true, value: t }
}

export function isSection(v: unknown): v is SectionName {
  return typeof v === 'string' && (SECTIONS as readonly string[]).includes(v)
}

const sign = (t: string) => (t === 'income' || t === 'transfer_in' ? 1 : t === 'expense' || t === 'transfer_out' ? -1 : 0)
const live = (e: LedgerEntry) => !e.voidedAt

/** Balance of every purse in kobo, voided entries excluded. */
export function balancesKobo(entries: LedgerEntry[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of entries) {
    if (!live(e)) continue
    out[e.purse] = (out[e.purse] ?? 0) + sign(e.type) * toKobo(e.amount)
  }
  return out
}

export const netWorthKobo = (entries: LedgerEntry[]) => Object.values(balancesKobo(entries)).reduce((a, b) => a + b, 0)

export interface Overdraft { purse: string; at: Date; balanceKobo: number }

/**
 * Replay the ledger in time order and report the first moment any purse dips below zero (I1).
 * Within one day, money coming in is applied before money going out, so a transfer's own legs
 * or a same-day income + spend are not flagged as an overdraft.
 */
export function findOverdraft(entries: LedgerEntry[]): Overdraft | null {
  // Entries are dated by DAY (a form sends a date, not a time), so order by calendar day, not by the clock.
  const day = (d: Date | string) => Math.floor(ms(d) / 86_400_000)
  const rows = entries.filter(live).map((e, i) => ({ e, i, t: day(e.entryDate), c: ms(e.createdAt), s: sign(e.type) }))
  rows.sort((a, b) => a.t - b.t || b.s - a.s || a.c - b.c || a.i - b.i)
  const bal: Record<string, number> = {}
  for (const { e, t, s } of rows) {
    const next = (bal[e.purse] ?? 0) + s * toKobo(e.amount)
    bal[e.purse] = next
    if (next < 0) {
      // Only a failure if no later row at the exact same instant would bring it back (handled by the ordering above).
      return { purse: e.purse, at: new Date(t * 86_400_000), balanceKobo: next }
    }
  }
  return null
}

export interface IntegrityIssue { code: 'overdraft' | 'unbalanced-transfer' | 'orphan-transfer' | 'bad-amount' | 'unknown-type'; message: string }

/** Full audit of a ledger: used by the service before committing a write and by the page's "Ledger check". */
export function auditLedger(entries: LedgerEntry[]): { ok: boolean; issues: IntegrityIssue[]; balancesKobo: Record<string, number>; netWorthKobo: number } {
  const issues: IntegrityIssue[] = []
  const liveRows = entries.filter(live)

  for (const e of liveRows) {
    if (!['income', 'expense', 'transfer_in', 'transfer_out'].includes(e.type)) issues.push({ code: 'unknown-type', message: `Unknown entry type "${e.type}".` })
    if (!(e.amount > 0) || !Number.isFinite(e.amount) || Math.abs(e.amount * 100 - toKobo(e.amount)) > 1e-6) issues.push({ code: 'bad-amount', message: `An entry has an invalid amount (${e.amount}).` })
  }

  // I2: every transfer group nets to zero; every transfer leg belongs to a group of exactly one out + one in.
  const groups = new Map<string, { out: number; in: number; legs: number }>()
  for (const e of liveRows) {
    if (e.type !== 'transfer_in' && e.type !== 'transfer_out') continue
    const key = e.groupId ?? e.allocationId
    if (!key) { issues.push({ code: 'orphan-transfer', message: 'A transfer leg has no partner.' }); continue }
    const g = groups.get(key) ?? { out: 0, in: 0, legs: 0 }
    if (e.type === 'transfer_out') g.out += toKobo(e.amount); else g.in += toKobo(e.amount)
    g.legs++
    groups.set(key, g)
  }
  for (const [key, g] of groups) {
    if (g.out !== g.in || g.legs !== 2) issues.push({ code: 'unbalanced-transfer', message: `Transfer ${key.slice(0, 8)} does not balance (out ${fromKobo(g.out)}, in ${fromKobo(g.in)}).` })
  }

  const od = findOverdraft(entries)
  if (od) issues.push({ code: 'overdraft', message: `"${od.purse}" would be ₦${fromKobo(-od.balanceKobo).toFixed(2)} short on ${od.at.toISOString().slice(0, 10)}.` })

  const balances = balancesKobo(entries)
  return { ok: issues.length === 0, issues, balancesKobo: balances, netWorthKobo: Object.values(balances).reduce((a, b) => a + b, 0) }
}

// ── Budget maths (zero-based / envelope) ────────────────────────────────────

export interface MonthEntry extends LedgerEntry { category: string; priority?: string | null }

const inMonth = (e: LedgerEntry, month: string) => new Date(e.entryDate).toISOString().slice(0, 7) === month

/** Income, spending and savings for one month, from real entries only (transfers are movements, not income or spending). */
export function monthSummary(entries: MonthEntry[], month: string) {
  let incomeK = 0
  let spentK = 0
  const bySection: Record<SectionName, number> = { Need: 0, Want: 0, Offerings: 0, Savings: 0 }
  const byCategory: Record<string, number> = {}
  for (const e of entries) {
    if (!live(e) || !inMonth(e, month)) continue
    const k = toKobo(e.amount)
    if (e.type === 'income') incomeK += k
    else if (e.type === 'expense') {
      spentK += k
      if (isSection(e.priority)) bySection[e.priority] += k
      byCategory[e.category] = (byCategory[e.category] ?? 0) + k
    }
  }
  return { incomeK, spentK, netK: incomeK - spentK, bySectionK: bySection, byCategoryK: byCategory, savingsRatePct: incomeK > 0 ? Math.round(((incomeK - spentK) / incomeK) * 1000) / 10 : null }
}

/** The 50/30/20 guideline, adapted with Offerings first: 10 / 40 / 20 / 30 of income. Used as a benchmark, never a rule. */
export const BENCHMARK_PCT: Record<SectionName, number> = { Offerings: 10, Need: 40, Want: 20, Savings: 30 }

/** Months of essential spending the Savings purse would cover (emergency-fund runway). */
export function runwayMonths(savingsKobo: number, avgMonthlyNeedKobo: number): number | null {
  if (avgMonthlyNeedKobo <= 0) return null
  return Math.round((savingsKobo / avgMonthlyNeedKobo) * 10) / 10
}
