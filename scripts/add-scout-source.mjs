#!/usr/bin/env node
// Add a site to a user's opportunity scout ("Your sites"): the scout reads it on every run, as an RSS feed
// when it has one, else as a page whose links are the listings. Safe to run twice (no duplicates).
//
//   node --env-file=.env scripts/add-scout-source.mjs --email you@example.com --url https://site.com/
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { PrismaClient } = require('@prisma/client')
const { PrismaNeon } = require('@prisma/adapter-neon')
const { neonConfig } = require('@neondatabase/serverless')
neonConfig.webSocketConstructor = require('ws')

const flag = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined }
const email = (flag('email') ?? '').trim().toLowerCase()
const raw = (flag('url') ?? '').trim()
if (!email || !raw) { console.error('usage: --email <email> --url <https://…>'); process.exit(1) }
let url
try { url = new URL(raw).toString() } catch { console.error(`✖ not a URL: ${raw}`); process.exit(1) }
if (!process.env.DATABASE_URL) { console.error('✖ DATABASE_URL missing — run with --env-file=.env'); process.exit(1) }

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) })
const profile = await prisma.profile.findUnique({ where: { email } })
if (!profile) { console.error(`✖ No Inchstone account for "${email}".`); process.exit(1) }
const scout = (await prisma.scoutProfile.findUnique({ where: { userId: profile.userId } })) ?? (await prisma.scoutProfile.create({ data: { userId: profile.userId } }))
const before = Array.isArray(scout.sources) ? scout.sources.filter((s) => typeof s === 'string') : []
const host = new URL(url).hostname.replace(/^www\./, '')
if (before.some((s) => { try { return new URL(s).toString() === url } catch { return false } })) {
  console.log(`Already there: ${url}`)
} else {
  await prisma.scoutProfile.update({ where: { id: scout.id }, data: { sources: [...before, url] } })
  console.log(`Added ${url} (${host}) for ${email}`)
}
const after = await prisma.scoutProfile.findUnique({ where: { id: scout.id }, select: { sources: true, builtIn: true, lastRunAt: true } })
console.log('Sources now:', after.sources, '· built-in feeds:', after.builtIn ? 'on' : 'off', '· last scout run:', after.lastRunAt?.toISOString() ?? 'never')
await prisma.$disconnect()
