// Every change to a user's money goes through here, and nowhere else.
//
// Each operation runs in ONE database transaction that first takes a per-user advisory lock, so two
// requests (a double tap, two devices, the AI assistant and the page) can never both read the same
// balance and both spend it. Inside the lock the service loads the whole ledger, applies the change
// in memory, and runs the full audit (see ledger.ts): if ANY invariant would break, nothing is written.
import { randomUUID } from 'crypto'
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import {
  CURRENCY, MAIN, RESERVED_CATEGORIES, SECTIONS, auditLedger, balancesKobo, fromKobo, isSection, monthSummary,
  parseAmount, parseEntryDate, parseText, runwayMonths, toKobo, BENCHMARK_PCT,
  type LedgerEntry, type SectionName,
} from './ledger'

export class FinanceError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

type Tx = Prisma.TransactionClient

const ENTRY_SELECT = {
  id: true, type: true, amount: true, purse: true, entryDate: true, createdAt: true, voidedAt: true,
  groupId: true, allocationId: true, category: true, priority: true,
} as const

type Row = LedgerEntry & { id: string; category: string; priority: string | null }

async function locked<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'finance:' + userId}))`
    return fn(tx)
  }, { timeout: 20_000, maxWait: 10_000 })
}

const loadLedger = (tx: Tx, userId: string) => tx.financialEntry.findMany({ where: { userId }, select: ENTRY_SELECT }) as Promise<Row[]>

function assertSound(entries: LedgerEntry[]) {
  const a = auditLedger(entries)
  if (!a.ok) throw new FinanceError(a.issues[0].message + ' Nothing was changed.')
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

async function usablePurse(tx: Tx, userId: string, name: unknown, label = 'Purse') {
  const t = parseText(name, label, 40, true)
  if (!t.ok) throw new FinanceError(t.error)
  const purses = await tx.purse.findMany({ where: { userId } })
  const hit = purses.find((p) => p.name === t.value) ?? purses.find((p) => sameName(p.name, t.value!))
  if (!hit) throw new FinanceError(`${label} "${t.value}" does not exist.`)
  if (hit.archivedAt) throw new FinanceError(`${label} "${hit.name}" is archived.`)
  return hit
}

const need = <T,>(r: { ok: true; value: T } | { ok: false; error: string }): T => {
  if (!r.ok) throw new FinanceError(r.error)
  return r.value
}

const monthKey = (v: unknown) => {
  if (typeof v !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) throw new FinanceError('Month must look like 2026-11.')
  return v
}
const monthStart = (m: string) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo - 1, 1)) }
/** Planning further than next month would move money in the future; reject it. */
function planMonth(m: string) {
  const now = new Date()
  const limit = `${new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 7)}`
  if (m < '2000-01' || m > limit) throw new FinanceError('You can plan from the past up to next month only.')
}

// ── Purses ──────────────────────────────────────────────────────────────────

export async function ensureDefaultPurses(userId: string) {
  const n = await prisma.purse.count({ where: { userId } })
  if (n === 0) {
    await prisma.purse.createMany({
      data: [{ userId, name: MAIN, icon: '👜', color: '#3B82F6' }, { userId, name: 'Savings', icon: '🏦', color: '#8B5CF6' }],
      skipDuplicates: true,
    })
  }
}

export async function createPurse(userId: string, input: { name?: unknown; icon?: unknown; color?: unknown }) {
  const name = need(parseText(input.name, 'Purse name', 30, true))!
  return locked(userId, async (tx) => {
    const all = await tx.purse.findMany({ where: { userId } })
    if (all.some((p) => sameName(p.name, name))) throw new FinanceError('A purse with this name already exists.', 409)
    return tx.purse.create({ data: { userId, name, icon: typeof input.icon === 'string' && input.icon ? input.icon.slice(0, 8) : '👜', color: typeof input.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(input.color) ? input.color : '#3B82F6' } })
  })
}

export async function updatePurse(userId: string, id: string, input: { name?: unknown; icon?: unknown; color?: unknown }) {
  return locked(userId, async (tx) => {
    const purse = await tx.purse.findFirst({ where: { id, userId } })
    if (!purse) throw new FinanceError('Purse not found.', 404)
    const data: Prisma.PurseUpdateInput = {}
    if (typeof input.icon === 'string' && input.icon) data.icon = input.icon.slice(0, 8)
    if (typeof input.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(input.color)) data.color = input.color

    if (input.name !== undefined) {
      const name = need(parseText(input.name, 'Purse name', 30, true))!
      if (name !== purse.name) {
        if (purse.name === MAIN) throw new FinanceError('Main is where income lands, so it cannot be renamed.')
        const all = await tx.purse.findMany({ where: { userId } })
        if (all.some((p) => p.id !== id && sameName(p.name, name))) throw new FinanceError('A purse with this name already exists.', 409)
        // Entries and plans point at a purse BY NAME, so they move with it in the same transaction.
        // Otherwise the renamed purse would show a zero balance and the money would vanish.
        await tx.financialEntry.updateMany({ where: { userId, purse: purse.name }, data: { purse: name } })
        await tx.sectionAllocation.updateMany({ where: { userId, purse: purse.name }, data: { purse: name } })
        await tx.sectionAllocation.updateMany({ where: { userId, sourcePurse: purse.name }, data: { sourcePurse: name } })
        data.name = name
      }
    }
    return tx.purse.update({ where: { id }, data })
  })
}

/** A purse is archived, never deleted: it must be empty first, and its history stays readable. */
export async function archivePurse(userId: string, id: string) {
  return locked(userId, async (tx) => {
    const purse = await tx.purse.findFirst({ where: { id, userId } })
    if (!purse) throw new FinanceError('Purse not found.', 404)
    if (purse.name === MAIN) throw new FinanceError('Main is where income lands and cannot be removed.')
    if (purse.archivedAt) return purse
    const bal = balancesKobo(await loadLedger(tx, userId))[purse.name] ?? 0
    if (bal !== 0) throw new FinanceError(`"${purse.name}" still holds ₦${fromKobo(bal).toFixed(2)}. Transfer it to another purse first.`, 409)
    const plans = await tx.sectionAllocation.count({ where: { userId, amount: { gt: 0 }, OR: [{ purse: purse.name }, { sourcePurse: purse.name }] } })
    if (plans > 0) throw new FinanceError(`"${purse.name}" is used by an envelope plan. Change that plan first.`, 409)
    return tx.purse.update({ where: { id }, data: { archivedAt: new Date() } })
  })
}

// ── Entries ─────────────────────────────────────────────────────────────────

export interface RecordInput {
  type?: unknown; amount?: unknown; category?: unknown; description?: unknown; comments?: unknown
  priority?: unknown; purse?: unknown; entryDate?: unknown; itemId?: unknown; currency?: unknown; requestId?: unknown
}

function cleanText(input: RecordInput) {
  const category = need(parseText(input.category, 'Category', 60, true))!
  if (RESERVED_CATEGORIES.includes(category.toLowerCase())) throw new FinanceError(`"${category}" is reserved for transfers and envelope funding. Pick another category.`)
  return {
    category,
    description: need(parseText(input.description, 'Description', 200)),
    comments: need(parseText(input.comments, 'Comments', 500)),
  }
}

function requestKey(v: unknown) {
  if (v === undefined || v === null || v === '') return null
  if (typeof v !== 'string' || v.length > 64) throw new FinanceError('requestId must be a short string.')
  return v
}

/** Record income or spending. Transfers are a different operation (see `transfer`). */
export async function recordEntry(userId: string, input: RecordInput) {
  if (input.type !== 'income' && input.type !== 'expense') {
    throw new FinanceError('Only income and expenses can be recorded here. Move money between purses with a transfer.')
  }
  if (input.currency !== undefined && input.currency !== null && input.currency !== CURRENCY) throw new FinanceError(`Only ${CURRENCY} is supported.`)
  const amount = need(parseAmount(input.amount))
  const entryDate = need(parseEntryDate(input.entryDate))
  const text = cleanText(input)
  const requestId = requestKey(input.requestId)

  let priority: SectionName | null = null
  if (input.type === 'expense') {
    if (!isSection(input.priority)) throw new FinanceError(`Choose the envelope this spending belongs to: ${SECTIONS.join(', ')}.`)
    priority = input.priority
  }

  return locked(userId, async (tx) => {
    if (requestId) {
      const dup = await tx.financialEntry.findUnique({ where: { userId_requestId: { userId, requestId } } })
      if (dup) return { entry: dup, duplicate: true }
    }
    // Income always lands in Main; spending leaves from the purse it names (default Main).
    const purse = input.type === 'income' ? await usablePurse(tx, userId, MAIN) : await usablePurse(tx, userId, input.purse ?? MAIN)
    const ledger = await loadLedger(tx, userId)
    assertSound([...ledger, { type: input.type as string, amount, purse: purse.name, entryDate, createdAt: new Date() }])
    const entry = await tx.financialEntry.create({
      data: {
        userId, type: input.type as string, amount, currency: CURRENCY, entryDate, purse: purse.name, priority,
        itemId: typeof input.itemId === 'string' && input.itemId ? input.itemId : null, requestId, ...text,
      },
    })
    return { entry, duplicate: false }
  })
}

/** Move money between two purses: one transaction, two legs, same amount, one groupId. */
export async function transfer(userId: string, input: { amount?: unknown; from?: unknown; to?: unknown; description?: unknown; entryDate?: unknown; requestId?: unknown }) {
  const amount = need(parseAmount(input.amount))
  const entryDate = need(parseEntryDate(input.entryDate))
  const description = need(parseText(input.description, 'Note', 200))
  const requestId = requestKey(input.requestId)
  return locked(userId, async (tx) => {
    if (requestId) {
      const dup = await tx.financialEntry.findUnique({ where: { userId_requestId: { userId, requestId } } })
      if (dup) return { groupId: dup.groupId, duplicate: true }
    }
    const from = await usablePurse(tx, userId, input.from, 'Source purse')
    const to = await usablePurse(tx, userId, input.to, 'Destination purse')
    if (from.id === to.id) throw new FinanceError('Choose two different purses.')
    const groupId = randomUUID()
    const note = description ?? `Transfer from ${from.name} to ${to.name}`
    const legs = [
      { type: 'transfer_out', purse: from.name, category: 'Transfer' },
      { type: 'transfer_in', purse: to.name, category: 'Transfer' },
    ]
    assertSound([...(await loadLedger(tx, userId)), ...legs.map((l) => ({ ...l, amount, entryDate, groupId, createdAt: new Date() }))])
    await tx.financialEntry.createMany({
      data: legs.map((l, i) => ({ userId, ...l, amount, currency: CURRENCY, entryDate, description: note, groupId, requestId: requestId && i === 0 ? requestId : null })),
    })
    return { groupId, duplicate: false }
  })
}

/** Void a mistake. A transfer is voided as a pair; envelope funding is changed through the plan, not here. */
export async function voidEntry(userId: string, id: string, reason?: unknown) {
  const why = need(parseText(reason, 'Reason', 200)) ?? 'Voided by user'
  return locked(userId, async (tx) => {
    const entry = await tx.financialEntry.findFirst({ where: { id, userId } })
    if (!entry) throw new FinanceError('Entry not found.', 404)
    if (entry.voidedAt) throw new FinanceError('That entry is already voided.', 409)
    if (entry.allocationId) throw new FinanceError('This move funds an envelope. Change or clear that envelope\'s plan instead.')
    const ids = entry.groupId
      ? (await tx.financialEntry.findMany({ where: { userId, groupId: entry.groupId, voidedAt: null }, select: { id: true } })).map((r) => r.id)
      : [entry.id]
    const now = new Date()
    const ledger = await loadLedger(tx, userId)
    assertSound(ledger.map((e) => (ids.includes(e.id) ? { ...e, voidedAt: now } : e)))
    await tx.financialEntry.updateMany({ where: { userId, id: { in: ids } }, data: { voidedAt: now, voidReason: why } })
    return { voided: ids.length }
  })
}

/**
 * Edit an entry. Text fields change in place. Anything that moves money (amount, date, purse) voids the
 * old row and writes a replacement that points back at it, so history is never rewritten.
 */
export async function editEntry(userId: string, id: string, patch: RecordInput) {
  return locked(userId, async (tx) => {
    const old = await tx.financialEntry.findFirst({ where: { id, userId } })
    if (!old) throw new FinanceError('Entry not found.', 404)
    if (old.voidedAt) throw new FinanceError('A voided entry cannot be edited.', 409)
    if (old.type !== 'income' && old.type !== 'expense') throw new FinanceError('Transfers cannot be edited. Void it and make a new one.')
    if (old.allocationId) throw new FinanceError('Envelope funding is changed through the plan.')

    const next = {
      amount: patch.amount !== undefined ? need(parseAmount(patch.amount)) : old.amount,
      entryDate: patch.entryDate !== undefined ? need(parseEntryDate(patch.entryDate)) : old.entryDate,
      purse: old.type === 'income' ? MAIN : patch.purse !== undefined ? (await usablePurse(tx, userId, patch.purse)).name : old.purse,
      ...(patch.category !== undefined || patch.description !== undefined || patch.comments !== undefined
        ? cleanText({ category: patch.category ?? old.category, description: patch.description ?? old.description, comments: patch.comments ?? old.comments })
        : { category: old.category, description: old.description, comments: old.comments }),
      priority: old.type === 'expense' ? (patch.priority !== undefined ? (isSection(patch.priority) ? patch.priority : (() => { throw new FinanceError(`Envelope must be one of ${SECTIONS.join(', ')}.`) })()) : old.priority) : null,
    }
    const moneyChanged = toKobo(next.amount) !== toKobo(old.amount) || next.entryDate.getTime() !== old.entryDate.getTime() || next.purse !== old.purse

    if (!moneyChanged) {
      return tx.financialEntry.update({ where: { id }, data: { category: next.category, description: next.description, comments: next.comments, priority: next.priority } })
    }
    const now = new Date()
    const ledger = await loadLedger(tx, userId)
    assertSound([
      ...ledger.map((e) => (e.id === id ? { ...e, voidedAt: now } : e)),
      { type: old.type, amount: next.amount, purse: next.purse, entryDate: next.entryDate, createdAt: now },
    ])
    await tx.financialEntry.update({ where: { id }, data: { voidedAt: now, voidReason: 'Replaced by an edit' } })
    return tx.financialEntry.create({
      data: {
        userId, type: old.type, amount: next.amount, currency: CURRENCY, entryDate: next.entryDate, purse: next.purse,
        category: next.category, description: next.description, comments: next.comments, priority: next.priority,
        itemId: old.itemId, replacesId: old.id,
      },
    })
  })
}

// ── Envelope plans (assigning money a job) ─────────────────────────────────

export async function setAllocation(userId: string, input: { section?: unknown; month?: unknown; amount?: unknown; sourcePurse?: unknown; purse?: unknown }) {
  if (!isSection(input.section)) throw new FinanceError(`Envelope must be one of ${SECTIONS.join(', ')}.`)
  const section = input.section
  const month = monthKey(input.month)
  planMonth(month)
  const raw = typeof input.amount === 'string' ? input.amount.trim() : input.amount
  const amount = raw === 0 || raw === '0' || raw === '' ? 0 : need(parseAmount(raw))

  return locked(userId, async (tx) => {
    const source = await usablePurse(tx, userId, input.sourcePurse ?? MAIN, 'Source purse')
    const dest = await usablePurse(tx, userId, input.purse ?? MAIN, 'Destination purse')
    if (amount > 0 && source.id === dest.id) throw new FinanceError('The money must land in a different purse than it came from.')

    const existing = await tx.sectionAllocation.findUnique({ where: { userId_section_month: { userId, section, month } } })
    const allocationId = existing?.id ?? randomUUID()
    const now = new Date()
    const date = monthStart(month)
    const ledger = await loadLedger(tx, userId)
    const groupId = randomUUID()
    const legs = amount > 0
      ? [{ type: 'transfer_out', purse: source.name }, { type: 'transfer_in', purse: dest.name }]
      : []
    // Replace the old movement: its legs are voided (kept) and the new pair written, all or nothing.
    assertSound([
      ...ledger.map((e) => (e.allocationId === allocationId && !e.voidedAt ? { ...e, voidedAt: now } : e)),
      ...legs.map((l) => ({ ...l, amount, entryDate: date, groupId, allocationId, createdAt: now })),
    ])
    await tx.financialEntry.updateMany({ where: { userId, allocationId, voidedAt: null }, data: { voidedAt: now, voidReason: 'Envelope plan changed' } })
    const allocation = await tx.sectionAllocation.upsert({
      where: { userId_section_month: { userId, section, month } },
      update: { amount, sourcePurse: source.name, purse: dest.name },
      create: { id: allocationId, userId, section, month, amount, sourcePurse: source.name, purse: dest.name },
    })
    if (legs.length) {
      await tx.financialEntry.createMany({
        data: legs.map((l) => ({
          userId, ...l, amount, currency: CURRENCY, entryDate: date, category: 'Allocation', priority: section,
          description: `${section} plan: ${source.name} → ${dest.name}`, groupId, allocationId,
        })),
      })
    }
    return allocation
  })
}

/** A budget line plans how an envelope's money is used by category. It is a plan, not money, so it only needs sane values. */
export async function upsertBudget(userId: string, input: { section?: unknown; category?: unknown; amount?: unknown; month?: unknown }) {
  if (!isSection(input.section)) throw new FinanceError(`Envelope must be one of ${SECTIONS.join(', ')}.`)
  const category = need(parseText(input.category, 'Category', 60, true))!
  if (RESERVED_CATEGORIES.includes(category.toLowerCase())) throw new FinanceError(`"${category}" is reserved.`)
  const month = monthKey(input.month)
  planMonth(month)
  const amount = need(parseAmount(input.amount))
  const section = input.section
  const budget = await prisma.budget.upsert({
    where: { userId_category_month_section: { userId, category, month, section } },
    update: { amount }, create: { userId, section, category, amount, month },
  })
  // Tell the caller when the category plans add up to more than the envelope was given, so the UI can warn.
  const [lines, alloc] = await Promise.all([
    prisma.budget.findMany({ where: { userId, section, month } }),
    prisma.sectionAllocation.findUnique({ where: { userId_section_month: { userId, section, month } } }),
  ])
  const plannedK = lines.reduce((s, l) => s + toKobo(l.amount), 0)
  const givenK = alloc ? toKobo(alloc.amount) : 0
  return { budget, overPlanned: plannedK > givenK, plannedKobo: plannedK, envelopeKobo: givenK }
}

// ── Overview (everything the Finance page shows, computed once, on the server) ──

export async function getOverview(userId: string, month: string) {
  monthKey(month)
  await ensureDefaultPurses(userId)
  const [purses, entries, allocations, budgets] = await Promise.all([
    prisma.purse.findMany({ where: { userId, archivedAt: null }, orderBy: { createdAt: 'asc' } }),
    prisma.financialEntry.findMany({ where: { userId } }),
    prisma.sectionAllocation.findMany({ where: { userId, month } }),
    prisma.budget.findMany({ where: { userId, month } }),
  ])
  const ledger = entries as unknown as (LedgerEntry & { category: string; priority: string | null })[]
  const audit = auditLedger(ledger)
  const bal = audit.balancesKobo
  const sum = monthSummary(ledger, month)

  // Average essential spending of the last 3 completed months, for the emergency-fund runway.
  const [y, m] = month.split('-').map(Number)
  const prev = [1, 2, 3].map((i) => new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7))
  const needAvgK = Math.round(prev.reduce((s, pm) => s + monthSummary(ledger, pm).bySectionK.Need, 0) / 3)
  const savingsK = bal['Savings'] ?? 0

  const sections = SECTIONS.map((section) => {
    const alloc = allocations.find((a) => a.section === section)
    const assignedK = alloc ? toKobo(alloc.amount) : 0
    const spentK = sum.bySectionK[section]
    const lines = budgets.filter((b) => b.section === section)
    const plannedK = lines.reduce((s, l) => s + toKobo(l.amount), 0)
    const cats = new Set<string>([...lines.map((l) => l.category)])
    for (const e of ledger) if (!e.voidedAt && e.type === 'expense' && e.priority === section && new Date(e.entryDate).toISOString().slice(0, 7) === month) cats.add(e.category)
    return {
      section,
      benchmarkPct: BENCHMARK_PCT[section],
      actualPct: sum.incomeK > 0 ? Math.round((spentK / sum.incomeK) * 1000) / 10 : null,
      assigned: fromKobo(assignedK), spent: fromKobo(spentK), remaining: fromKobo(assignedK - spentK),
      planned: fromKobo(plannedK), overPlanned: plannedK > assignedK,
      allocation: alloc ? { id: alloc.id, sourcePurse: alloc.sourcePurse, purse: alloc.purse } : null,
      categories: [...cats].map((category) => {
        const line = lines.find((l) => l.category === category)
        return { category, budgetId: line?.id ?? null, planned: line ? line.amount : 0, spent: fromKobo(sum.byCategoryK[category] ?? 0) }
      }),
    }
  })
  const assignedTotalK = sections.reduce((s, x) => s + toKobo(x.assigned), 0)

  // Month reconciliation: for every purse, opening balance + what came in and went out = closing balance.
  // The total is then cross-checked against a separate calculation (every live entry up to month end), so a
  // gap anywhere would show as reconciles=false instead of being hidden.
  const key = (e: LedgerEntry) => new Date(e.entryDate).toISOString().slice(0, 7)
  const liveRows = ledger.filter((e) => !e.voidedAt)
  const names = [...new Set(liveRows.filter((e) => key(e) <= month).map((e) => e.purse))]
  const rows = names.map((name) => {
    let opening = 0, income = 0, spent = 0, tin = 0, tout = 0
    for (const e of liveRows) {
      if (e.purse !== name) continue
      const k = toKobo(e.amount)
      const mk = key(e)
      if (mk < month) opening += e.type === 'income' || e.type === 'transfer_in' ? k : -k
      else if (mk === month) {
        if (e.type === 'income') income += k
        else if (e.type === 'expense') spent += k
        else if (e.type === 'transfer_in') tin += k
        else if (e.type === 'transfer_out') tout += k
      }
    }
    return { name, opening, income, spent, tin, tout, closing: opening + income - spent + tin - tout }
  }).filter((r) => r.opening || r.income || r.spent || r.tin || r.tout)
  const upToMonthEnd = balancesKobo(liveRows.filter((e) => key(e) <= month))
  const closingTotal = rows.reduce((a, r) => a + r.closing, 0)
  const openingTotal = rows.reduce((a, r) => a + r.opening, 0)
  const reconciliation = {
    rows: rows.map((r) => ({ name: r.name, opening: fromKobo(r.opening), income: fromKobo(r.income), spent: fromKobo(r.spent), transfersIn: fromKobo(r.tin), transfersOut: fromKobo(r.tout), closing: fromKobo(r.closing) })),
    openingNetWorth: fromKobo(openingTotal),
    closingNetWorth: fromKobo(closingTotal),
    reconciles:
      openingTotal + sum.incomeK - sum.spentK === closingTotal &&
      rows.every((r) => r.closing === (upToMonthEnd[r.name] ?? 0)) &&
      rows.reduce((a, r) => a + r.tin - r.tout, 0) === 0,
  }

  return {
    month,
    currency: CURRENCY,
    purses: purses.map((p) => ({ id: p.id, name: p.name, icon: p.icon, color: p.color, balance: fromKobo(bal[p.name] ?? 0) })),
    netWorth: fromKobo(audit.netWorthKobo),
    readyToAssign: fromKobo(bal[MAIN] ?? 0), // money still sitting in Main with no job
    income: fromKobo(sum.incomeK), spent: fromKobo(sum.spentK), net: fromKobo(sum.netK),
    savingsRatePct: sum.savingsRatePct,
    assignedTotal: fromKobo(assignedTotalK),
    unassignedIncome: fromKobo(Math.max(0, sum.incomeK - assignedTotalK)),
    sections,
    reconciliation,
    runwayMonths: runwayMonths(savingsK, needAvgK),
    integrity: { ok: audit.ok, issues: audit.issues.map((i) => i.message), entryCount: ledger.filter((e) => !e.voidedAt).length, voidedCount: ledger.filter((e) => !!e.voidedAt).length },
  }
}
