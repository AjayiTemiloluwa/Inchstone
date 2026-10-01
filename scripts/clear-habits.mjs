#!/usr/bin/env node
/**
 * Clear a user's habits, keeping only the instances from a cut-off date onwards.
 *
 * Habits in Inchstone are materialised `Task` rows with `isHabit = true` — one
 * row per due day (see /api/habits POST and scripts/restore-habits.mjs). There
 * is no separate Habit table, so "clearing habits" means deleting those Task
 * rows. `Task.date` is always UTC midnight of the day it belongs to, which is
 * why the cut-off below is a plain UTC instant.
 *
 * The cut-off is INCLUSIVE: an instance dated on the cut-off day itself (or any
 * later day) survives; everything strictly before it is deleted. So the default
 * request — keep habits from 2 October — removes every instance up to and
 * including 1 October and leaves today's and the future ones alone.
 *
 * Nothing else is touched: regular deeds, goals, notes, finances, partners,
 * daily scores and trackers are all left alone.
 *
 * Caveats worth knowing before you run this:
 *   • Past habit instances are what the habit graph on the day page is drawn
 *     from, so deleting them erases that history for those days.
 *   • If two-way Google Calendar sync is on, habit rows can carry a
 *     googleEventId. Deleting the rows here does NOT delete the matching
 *     Google Calendar events — clean those up in Google if you need to.
 *
 * Because this is destructive and irreversible, it is a DRY RUN by default: it
 * counts what it *would* delete and writes nothing. Add --apply to commit,
 * which first dumps the rows to scripts/backups/ so they can be restored.
 *
 * Usage
 *   node --env-file=.env scripts/clear-habits.mjs --list
 *   node --env-file=.env scripts/clear-habits.mjs
 *   node --env-file=.env scripts/clear-habits.mjs --from 2026-10-02 --apply
 *
 * Flags
 *   --email <address>     whose habits to clear (default the owner below)
 *   --userId <clerkId>    skip the email → userId lookup
 *   --from <YYYY-MM-DD>   cut-off; this day and later are KEPT (default: today)
 *   --title <text>        only clear this habit title (repeatable)
 *   --no-backup           skip the JSON backup written before an --apply
 *   --apply               actually delete (default is a dry run)
 *   --list                list known profiles and exit
 */

import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('@prisma/client')
const { PrismaNeon } = require('@prisma/adapter-neon')
const { neonConfig } = require('@neondatabase/serverless')
const ws = require('ws')

neonConfig.webSocketConstructor = ws

const DEFAULT_EMAIL = 'temiloluwaajayi2019@gmail.com'
const HERE = dirname(fileURLToPath(import.meta.url))

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

    // A repeated flag accumulates, so --title can be passed more than once
    // without needing an exotic separator — habit titles contain commas.
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

function fail(message) {
  console.error(`✖ ${message}`)
  process.exit(1)
}

const flags = parseArgs(process.argv.slice(2))

if (flags.help) {
  console.log('See the header of scripts/clear-habits.mjs for usage.')
  process.exit(0)
}

const apply = flags.apply === true
const noBackup = flags.noBackup === true
const email = typeof flags.email === 'string' ? flags.email.toLowerCase() : DEFAULT_EMAIL
const titles = toStringList(flags.title)

const toDateString = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** UTC midnight of the day a `YYYY-MM-DD` names — the shape Task.date uses. */
function parseDateString(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const [, y, m, d] = match
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)))
  return Number.isNaN(date.getTime()) ? null : date
}

const fromStr = typeof flags.from === 'string' ? flags.from : toDateString(new Date())
const cutover = parseDateString(fromStr)
if (!cutover) fail(`--from must look like YYYY-MM-DD (got "${fromStr}")`)

/* ── Main ─────────────────────────────────────────────────────────────── */

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  fail('DATABASE_URL is missing. Run with: node --env-file=.env scripts/clear-habits.mjs')
}

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) })

const iso = (date) => date.toISOString().slice(0, 10)

const DAY = 24 * 60 * 60 * 1000

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

  // ── 2. Scope: this user's habit instances (optionally just some titles) ──
  const base = { userId, isHabit: true }
  if (titles.length > 0) base.title = { in: titles }

  const doomedWhere = { ...base, date: { lt: cutover } }
  const keepWhere = { ...base, date: { gte: cutover } }

  const [total, toDelete, toKeep, completedToDelete, buckets] = await Promise.all([
    prisma.task.count({ where: base }),
    prisma.task.count({ where: doomedWhere }),
    prisma.task.count({ where: keepWhere }),
    prisma.task.count({ where: { ...doomedWhere, completed: true } }),
    prisma.task.groupBy({
      by: ['date'],
      where: base,
      _count: { _all: true },
      orderBy: { date: 'asc' },
    }),
  ])

  console.log(`User:      ${matchedEmail ?? userId}  (${userId})`)
  console.log(`Scope:     ${titles.length > 0 ? titles.map(t => `"${t}"`).join(', ') : 'all habits'}`)
  console.log(`Keep from: ${iso(cutover)} (inclusive — this day and later survive)`)
  console.log('')
  if (buckets.length > 0) {
    const first = iso(buckets[0].date)
    const last = iso(buckets[buckets.length - 1].date)
    console.log(`Range:     ${first} → ${last}  (${buckets.length} distinct days)`)
  }
  console.log(`Habits:    ${total} instances`)
  console.log(`Delete:    ${toDelete} instances  (${completedToDelete} of them completed)`)
  console.log(`Keep:      ${toKeep} instances`)

  // Show the days either side of the cut so the boundary is verifiable at a glance.
  const lo = new Date(cutover.getTime() - 3 * DAY)
  const hi = new Date(cutover.getTime() + 2 * DAY)
  const edge = buckets.filter(b => b.date >= lo && b.date <= hi)
  if (edge.length > 0) {
    console.log('')
    console.log(`Boundary (${iso(lo)} → ${iso(hi)}):`)
    for (const b of edge) {
      console.log(`  ${b.date < cutover ? 'delete' : 'keep  '}  ${iso(b.date)}  ${String(b._count._all).padStart(4)}`)
    }
  }

  if (toDelete === 0) {
    console.log('')
    console.log('Nothing to clear — no habit instances fall before that date.')
    return
  }

  if (!apply) {
    console.log('')
    console.log(`DRY RUN — nothing was deleted. Re-run with --apply to remove these ${toDelete} instances.`)
    return
  }

  // ── 3. Back the rows up before destroying them ──
  if (!noBackup) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const dir = join(HERE, 'backups')
    const safe = (matchedEmail ?? userId).replace(/[^a-z0-9.@_-]/gi, '_')
    const file = join(dir, `habits-before-${fromStr}-${safe}-${stamp}.json`)
    const rows = await prisma.task.findMany({ where: doomedWhere, orderBy: { date: 'asc' } })
    const dump = { userId, email: matchedEmail, cutover: iso(cutover), clearedAt: new Date().toISOString(), habits: rows }
    mkdirSync(dir, { recursive: true })
    writeFileSync(file, JSON.stringify(dump, null, 2))
    console.log(`Backup:    ${file}`)
  }

  // ── 4. Delete ──
  const result = await prisma.task.deleteMany({ where: doomedWhere })
  console.log(`✔ Deleted ${result.count} habit instances dated before ${iso(cutover)}.`)

  // ── 5. Confirm ──
  const [left, kept] = await Promise.all([
    prisma.task.count({ where: doomedWhere }),
    prisma.task.count({ where: keepWhere }),
  ])
  if (left > 0) {
    console.log(`⚠ ${left} instances before the cut-off still remain — re-run to clear the rest.`)
  } else {
    console.log(`✔ Verified: 0 habit instances before ${iso(cutover)}; ${kept} kept.`)
  }
}

main()
  .catch(error => {
    console.error('✖ clear-habits failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })