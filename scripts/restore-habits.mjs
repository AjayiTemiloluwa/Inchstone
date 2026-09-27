#!/usr/bin/env node
/**
 * Restore / re-seed a user's habit instances.
 *
 * Habits in Inchstone are materialised `Task` rows — one row per day (per
 * block), keyed by `title`. `/api/habits` POST creates them from "today" to
 * the end of the year, so a lost habit row is simply a missing `Task`. This
 * script writes those rows back without touching anything else.
 *
 * The restoration requested is a *daily 4-hour reading habit split across four
 * 6-hour blocks*: the 24-hour day is cut into 00–06, 06–12, 12–18 and 18–24,
 * and each block carries one hour of reading at the top of the block
 * (`--per-block`, default 1h ⇒ 4h/day total, ≥1h per block).
 *
 * Usage
 *   node --env-file=.env scripts/restore-habits.mjs --list
 *   node --env-file=.env scripts/restore-habits.mjs --email you@example.com
 *   node --env-file=.env scripts/restore-habits.mjs --email you@example.com --apply
 *
 * Flags
 *   --email <address>     who to restore (default the owner below)
 *   --userId <clerkId>    skip the email → userId lookup
 *   --prefix <text>       habit name prefix (default "Reading")
 *   --per-block <hours>   reading hours inside each 6-hour block (default 1)
 *   --from <YYYY-MM-DD>   first day (default: today, local)
 *   --to <YYYY-MM-DD>     last day (default: 31 Dec of the `from` year)
 *   --goalId <id>         owning daily goal (default: newest layer-6 item)
 *   --utc                 build times in UTC instead of local wall-clock
 *   --force               delete existing instances of these habits first
 *   --retire <title>      end a superseded habit from --from onwards (repeatable;
 *                         past instances are kept for the habit graph)
 *   --retire-all <title>  delete a superseded habit completely, history included
 *                         (repeatable)
 *   --apply               actually write (default is a dry run)
 *   --list                list known profiles and exit
 */

import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('@prisma/client')
const { PrismaNeon } = require('@prisma/adapter-neon')
const { neonConfig } = require('@neondatabase/serverless')
const ws = require('ws')

neonConfig.webSocketConstructor = ws

const DEFAULT_EMAIL = 'temiloluwaajayi2019@gmail.com'

// The four 6-hour blocks that tile the day. Reading happens at the top of each.
const BLOCKS = [
  { startHour: 0, endHour: 6 },
  { startHour: 6, endHour: 12 },
  { startHour: 12, endHour: 18 },
  { startHour: 18, endHour: 24 },
]

const parseArgs = (argv) => {
  const flags = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) {
      flags._.push(arg)
      continue
    }
    const [rawKey, inlineValue] = arg.slice(2).split('=')
    const key = rawKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    const next = argv[i + 1]
    let value
    if (inlineValue !== undefined) value = inlineValue
    else if (next !== undefined && !next.startsWith('--')) {
      value = next
      i++
    } else value = true

    // A repeated flag accumulates, so list-ish options (--retire) can be
    // passed more than once without needing an exotic separator — habit
    // titles contain commas.
    const prev = flags[key]
    if (prev === undefined) flags[key] = value
    else if (Array.isArray(prev)) prev.push(value)
    else flags[key] = [prev, value]
  }
  return flags
}

/** Normalises a flag that may be a single value or a repeated list. */
const toStringList = (value) =>
  value === undefined ? [] : (Array.isArray(value) ? value : [value]).filter(v => typeof v === 'string')

const flags = parseArgs(process.argv.slice(2))

if (flags.help) {
  console.log('See the header of scripts/restore-habits.mjs for usage.')
  process.exit(0)
}

const apply = flags.apply === true
const force = flags.force === true
const useUtc = flags.utc === true
const useLocal = !useUtc
const email = typeof flags.email === 'string' ? flags.email.toLowerCase() : DEFAULT_EMAIL
const prefix = typeof flags.prefix === 'string' ? flags.prefix : 'Reading'
const perBlock = Number(flags.perBlock ?? 1)
const explicitGoalId = typeof flags.goalId === 'string' ? flags.goalId : null
const retireTitles = toStringList(flags.retire)
const retireAllTitles = toStringList(flags.retireAll)

const toDateString = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const today = new Date()
const fromStr = typeof flags.from === 'string' ? flags.from : toDateString(today)
const from = parseDateString(fromStr)
if (!from) fail(`--from must look like YYYY-MM-DD (got "${fromStr}")`)

const toStr = typeof flags.to === 'string' ? flags.to : `${from.getFullYear()}-12-31`
const to = parseDateString(toStr)
if (!to) fail(`--to must look like YYYY-MM-DD (got "${toStr}")`)
if (to < from) fail('--to must be on or after --from')
if (!Number.isFinite(perBlock) || perBlock <= 0 || perBlock > 6) {
  fail(`--per-block must be between 0 and 6 hours (got "${flags.perBlock}")`)
}

function parseDateString(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const [, y, m, d] = match
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  return Number.isNaN(date.getTime()) ? null : date
}

function fail(message) {
  console.error(`✖ ${message}`)
  process.exit(1)
}

/* ── Habit definition ─────────────────────────────────────────────────── */

const blockLabel = (block) =>
  `${String(block.startHour).padStart(2, '0')}–${String(block.endHour).padStart(2, '0')}`

const habitTitles = BLOCKS.map(block => `${prefix} · ${blockLabel(block)}`)

/** UTC midnight — the shape `/api/habits` POST writes into `Task.date`. */
const dateOnly = (date) => new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))

/** Wall-clock time on that day, so the block shows up at the right hour. */
function timeOn(date, hour, minute = 0) {
  return useUtc
    ? new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute))
    : new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute)
}

const eachDay = (start, end) => {
  const days = []
  const cursor = new Date(start)
  while (cursor <= end) {
    days.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

/* ── Main ─────────────────────────────────────────────────────────────── */

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  fail('DATABASE_URL is missing. Run with: node --env-file=.env scripts/restore-habits.mjs')
}

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) })

async function main() {
  if (flags.list) {
    const profiles = await prisma.profile.findMany({
      select: { userId: true, email: true, name: true },
      orderBy: { email: 'asc' },
      take: 100,
    })
    console.log(`Known profiles (${profiles.length}):`)
    for (const p of profiles) console.log(`  ${p.email ?? '(no email)'}  →  ${p.userId}`)
    return
  }

  // ── 1. Resolve the user ──
  let userId = typeof flags.userId === 'string' ? flags.userId : null
  let matchedEmail = null
  if (!userId) {
    const profile = await prisma.profile.findUnique({ where: { email } })
    if (!profile) {
      fail(
        `No profile for "${email}". Pass --userId, or run --list to see who is onboarded ` +
          `(a Profile row is only written once the account visits the app).`,
      )
    }
    userId = profile.userId
    matchedEmail = profile.email
  }
  console.log(`User:    ${matchedEmail ?? userId}  (${userId})`)

  // ── 2. Resolve the owning daily goal — same lookup /api/habits POST uses ──
  const goal = explicitGoalId
    ? await prisma.item.findFirst({ where: { id: explicitGoalId, userId } })
    : await prisma.item.findFirst({ where: { userId, layer: 6 }, orderBy: { startDate: 'desc' } })
  if (!goal) {
    fail('No daily goal (layer 6) found for this user. Seed the framework first, or pass --goalId.')
  }
  console.log(`Goal:    ${goal.title}  (${goal.id})`)

  // ── 3. Build the rows we want to exist ──
  const days = eachDay(from, to)
  const recurrenceEnd = timeOn(to, 23, 59)
  const desired = []
  for (const day of days) {
    for (const block of BLOCKS) {
      desired.push({
        userId,
        goalId: goal.id,
        title: `${prefix} · ${blockLabel(block)}`,
        weight: 1,
        progress: 0,
        completed: false,
        date: dateOnly(day),
        startTime: timeOn(day, block.startHour),
        endTime: timeOn(day, block.startHour + perBlock),
        estimatedDuration: Math.round(perBlock * 60),
        isRecurring: true,
        recurrencePattern: 'daily',
        recurrenceEnd,
        isHabit: true,
      })
    }
  }

  const rangeWhere = {
    userId,
    isHabit: true,
    title: { in: habitTitles },
    date: { gte: dateOnly(from), lte: dateOnly(to) },
  }
  const existing = await prisma.task.findMany({
    where: rangeWhere,
    select: { id: true, title: true, date: true },
  })
  const existingKeys = new Set(
    existing.map(row => `${row.title}|${row.date.toISOString().slice(0, 10)}`),
  )
  const missing = desired.filter(
    row => !existingKeys.has(`${row.title}|${row.date.toISOString().slice(0, 10)}`),
  )

  // ── 4. Retire whatever the new blocks supersede (the "split" case) ──
  const retirePlans = []
  const futureCut = dateOnly(from)
  for (const title of retireTitles) {
    retirePlans.push({
      label: `future instances of "${title}" (kept before ${fromStr})`,
      where: { userId, isHabit: true, title, date: { gte: futureCut } },
    })
  }
  for (const title of retireAllTitles) {
    retirePlans.push({
      label: `every instance of "${title}" (history included)`,
      where: { userId, isHabit: true, title },
    })
  }
  for (const plan of retirePlans) plan.count = await prisma.task.count({ where: plan.where })

  console.log(`Window:  ${fromStr} → ${toStr}  (${days.length} days${useLocal ? ', local time' : ', UTC'})`)
  console.log(`Habits:  ${habitTitles.map(t => `"${t}"`).join(', ')}`)
  console.log(
    `Plan:    ${desired.length} instances (${BLOCKS.length}/day × ${perBlock}h = ${BLOCKS.length * perBlock}h/day)`,
  )
  console.log(`          ${existing.length} already exist, ${missing.length} to create.`)
  for (const plan of retirePlans) console.log(`Retire:  ${plan.count} × ${plan.label}`)

  // Past days are left alone unless --force, so a restore never rewrites the
  // completions that power the habit graph.
  const staleToRemove = []
  if (force) staleToRemove.push(...existing)
  for (const row of missing.slice(0, 8)) {
    console.log(`          + ${row.title}  ${row.startTime.toISOString()}`)
  }
  if (missing.length > 8) console.log(`          + … ${missing.length - 8} more`)

  if (!apply) {
    console.log('')
    console.log('DRY RUN — nothing was written. Re-run with --apply to create these rows.')
    return
  }

  for (const plan of retirePlans) {
    if (plan.count === 0) continue
    const result = await prisma.task.deleteMany({ where: plan.where })
    console.log(`✔ Retired ${result.count} — ${plan.label}`)
  }

  if (staleToRemove.length > 0) {
    const removed = await prisma.task.deleteMany({
      where: { id: { in: staleToRemove.map(row => row.id) } },
    })
    console.log(`Removed ${removed.count} existing instances (--force).`)
  }

  let created = 0
  for (let i = 0; i < missing.length; i += 500) {
    const batch = missing.slice(i, i + 500)
    const result = await prisma.task.createMany({ data: batch })
    created += result.count
  }
  console.log(`✔ Created ${created} habit instances.`)
}

main()
  .catch(error => {
    console.error('✖ restore-habits failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
