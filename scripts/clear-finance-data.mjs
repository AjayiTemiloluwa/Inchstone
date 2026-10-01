#!/usr/bin/env node
/**
 * Clear a user's finance data.
 *
 * The Finance module keeps four tables, all keyed by `userId`:
 *   FinancialEntry     — every transaction (income / expense / transfer_in / transfer_out)
 *   Budget             — per-category monthly budget amounts
 *   SectionAllocation  — monthly Need / Want / Offerings / Savings allocations
 *   Purse              — the user's purses (Main, Savings, …)
 *
 * This script deletes those rows for one user and nothing else. Deeds, goals,
 * notes, partners, etc. are untouched. Purses are removed too, because
 * `/api/purses` GET re-seeds the default Main + Savings purses on the next
 * visit — pass --keep-purses to leave the purse list (and its icons/colours)
 * alone.
 *
 * Because this is destructive and irreversible, it is a DRY RUN by default:
 * it counts what it *would* delete and writes nothing. Add --apply to commit,
 * which first dumps the rows to scripts/backups/ so they can be restored.
 *
 * Two pieces of finance state live in the browser, not the database, and are
 * therefore NOT cleared here — remove them from DevTools → Application →
 * Local Storage if you want a fully blank slate:
 *   monthlySavingsTarget          — the savings target shown on /finance
 *   inchstone-custom-categories   — user-typed category names
 *
 * Usage
 *   node --env-file=.env scripts/clear-finance-data.mjs --list
 *   node --env-file=.env scripts/clear-finance-data.mjs
 *   node --env-file=.env scripts/clear-finance-data.mjs --apply
 *
 * Flags
 *   --email <address>   whose finance data to clear (default the owner below)
 *   --userId <clerkId>  skip the email → userId lookup
 *   --keep-purses       keep the Purse rows (transactions/budgets still go)
 *   --no-backup         skip the JSON backup written before an --apply
 *   --apply             actually delete (default is a dry run)
 *   --list              list known profiles and exit
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
    flags[key] = value
  }
  return flags
}

function fail(message) {
  console.error(`✖ ${message}`)
  process.exit(1)
}

const flags = parseArgs(process.argv.slice(2))

if (flags.help) {
  console.log('See the header of scripts/clear-finance-data.mjs for usage.')
  process.exit(0)
}

const apply = flags.apply === true
const noBackup = flags.noBackup === true
const keepPurses = flags.keepPurses === true
const email = typeof flags.email === 'string' ? flags.email.toLowerCase() : DEFAULT_EMAIL

/* ── Main ─────────────────────────────────────────────────────────────── */

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  fail('DATABASE_URL is missing. Run with: node --env-file=.env scripts/clear-finance-data.mjs')
}

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) })

/** One entry per table to wipe, in an order that keeps relations happy. */
const buildTargets = () => {
  const targets = [
    { delegate: 'financialEntry', label: 'transactions (FinancialEntry)' },
    { delegate: 'budget', label: 'budgets (Budget)' },
    { delegate: 'sectionAllocation', label: 'section allocations (SectionAllocation)' },
  ]
  if (!keepPurses) {
    targets.push({ delegate: 'purse', label: 'purses (Purse)' })
  }
  return targets
}

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

  // ── 2. Count what is there now ──
  const targets = buildTargets()
  for (const target of targets) {
    target.count = await prisma[target.delegate].count({ where: { userId } })
  }
  const total = targets.reduce((sum, t) => sum + t.count, 0)

  for (const target of targets) {
    console.log(`Delete:  ${String(target.count).padStart(5)}  ×  ${target.label}`)
  }
  console.log(`Total:   ${String(total).padStart(5)} rows`)

  if (total === 0) {
    console.log('')
    console.log('Nothing to clear — this user has no finance data.')
    return
  }

  if (!apply) {
    console.log('')
    console.log('DRY RUN — nothing was deleted. Re-run with --apply to clear these rows.')
    return
  }

  // ── 3. Back the rows up before destroying them ──
  if (!noBackup) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const dir = join(HERE, 'backups')
    const safe = (matchedEmail ?? userId).replace(/[^a-z0-9.@_-]/gi, '_')
    const file = join(dir, `finance-${safe}-${stamp}.json`)
    const dump = { userId, email: matchedEmail, clearedAt: new Date().toISOString(), tables: {} }
    for (const target of targets) {
      dump.tables[target.delegate] = await prisma[target.delegate].findMany({ where: { userId } })
    }
    mkdirSync(dir, { recursive: true })
    writeFileSync(file, JSON.stringify(dump, null, 2))
    console.log(`Backup:  ${file}`)
  }

  // ── 4. Delete ──
  for (const target of targets) {
    const result = await prisma[target.delegate].deleteMany({ where: { userId } })
    console.log(`✔ Deleted ${result.count} — ${target.label}`)
  }

  // ── 5. Confirm ──
  const remaining = []
  for (const target of targets) {
    const left = await prisma[target.delegate].count({ where: { userId } })
    if (left > 0) remaining.push(`${left} × ${target.label}`)
  }
  if (remaining.length > 0) {
    console.log('')
    console.log(`⚠ ${remaining.join(', ')} still remain — re-run to clear the rest.`)
  } else {
    console.log('')
    console.log('✔ Finance data cleared.')
    if (!keepPurses) {
      console.log('  Default purses (Main, Savings) will be re-created automatically on the next /finance visit.')
    }
  }
}

main()
  .catch(error => {
    console.error('✖ clear-finance-data failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })