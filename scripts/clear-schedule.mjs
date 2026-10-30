#!/usr/bin/env node
/**
 * Clean a user's schedule:
 *   1. delete EVERY Task (deeds and habits) dated before today, and
 *   2. from today onward, delete duplicate copies — rows with the same title,
 *      day, time slot and habit flag — keeping one (a completed copy wins,
 *      otherwise the oldest).
 * Everything else from today onward is kept.
 *
 * Task.date is UTC midnight of its day. DRY RUN by default; --apply backs the
 * rows up to scripts/backups/ first, then deletes. Google events untouched.
 *
 * Usage
 *   node --env-file=.env scripts/clear-schedule.mjs
 *   node --env-file=.env scripts/clear-schedule.mjs --apply
 * Flags: --email <address>  --date <YYYY-MM-DD> (treat as "today")  --apply
 */
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('@prisma/client')
const { PrismaNeon } = require('@prisma/adapter-neon')
const { neonConfig } = require('@neondatabase/serverless')
neonConfig.webSocketConstructor = require('ws')

const HERE = dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const flag = name => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? undefined : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true)
}
const apply = flag('apply') === true
const email = (typeof flag('email') === 'string' ? flag('email') : 'temiloluwaajayi2019@gmail.com').toLowerCase()

const now = new Date()
const todayStr = typeof flag('date') === 'string'
  ? flag('date')
  : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(todayStr)
if (!m) { console.error(`✖ bad date "${todayStr}"`); process.exit(1) }
const today = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))

if (!process.env.DATABASE_URL) { console.error('✖ DATABASE_URL missing — run with --env-file=.env'); process.exit(1) }
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) })

const stamp = d => (d ? new Date(d).getTime() : 0)

async function main() {
  const profile = await prisma.profile.findUnique({ where: { email } })
  if (!profile) { console.error(`✖ No profile for "${email}".`); process.exit(1) }
  const userId = profile.userId

  const past = { userId, date: { lt: today } }
  const [pastCount, pastDone, upcoming] = await Promise.all([
    prisma.task.count({ where: past }),
    prisma.task.count({ where: { ...past, completed: true } }),
    prisma.task.findMany({ where: { userId, date: { gte: today } }, orderBy: { createdAt: 'asc' } }),
  ])

  // Group today-onward rows; the first (or a completed) row in a group is kept.
  const groups = new Map()
  for (const t of upcoming) {
    const key = [t.date.getTime(), t.title.trim().toLowerCase(), stamp(t.startTime), stamp(t.endTime), t.isHabit].join('|')
    const g = groups.get(key)
    if (!g) groups.set(key, [t])
    else g.push(t)
  }
  const dupes = []
  for (const g of groups.values()) {
    if (g.length < 2) continue
    const keep = g.find(t => t.completed) ?? g[0]
    for (const t of g) if (t.id !== keep.id) dupes.push(t)
  }

  console.log(`User:   ${email}  (${userId})`)
  console.log(`Today:  ${todayStr} (kept, along with the future)`)
  console.log(`Delete: ${pastCount} tasks before today — deeds and habits (${pastDone} completed)`)
  console.log(`Delete: ${dupes.length} duplicate copies from today onward (${groups.size} unique rows kept)`)
  if (pastCount + dupes.length === 0) { console.log('Nothing to delete.'); return }
  if (!apply) { console.log('\nDRY RUN — nothing deleted. Re-run with --apply.'); return }

  const file = join(HERE, 'backups', `schedule-before-${todayStr}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  const pastRows = await prisma.task.findMany({ where: past })
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify({ userId, email, today: todayStr, past: pastRows, duplicates: dupes }, null, 2))
  console.log(`Backup: ${file}`)

  const a = await prisma.task.deleteMany({ where: past })
  const b = await prisma.task.deleteMany({ where: { id: { in: dupes.map(d => d.id) } } })
  console.log(`✔ Deleted ${a.count} past tasks and ${b.count} duplicates.`)
  console.log(`Verified remaining before today: ${await prisma.task.count({ where: past })}`)
}

main().catch(e => { console.error('✖ failed:', e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
