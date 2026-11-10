#!/usr/bin/env node
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { PrismaClient } = require('@prisma/client')
const { PrismaNeon } = require('@prisma/adapter-neon')
const { neonConfig } = require('@neondatabase/serverless')
const ws = require('ws')
neonConfig.webSocketConstructor = ws
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) })
;(async () => {
  try {
    const start = new Date(Date.UTC(2026, 10, 8))
    const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1)
    const frogs = await prisma.task.findMany({
      where: {
        userId: 'user_3FdRYn5PJmNDRVa0vG9j7bfLLvz',
        isFrog: true,
        date: { gte: start, lt: end },
      },
      orderBy: { title: 'asc' },
    })
    console.log(`Frogs for 2026-11-08 (${frogs.length}):`)
    for (const f of frogs) {
      console.log(' •', f.title, '| important:', f.isImportant, '| priority:', f.priority, '| estMin:', f.estimatedDuration, '| completed:', f.completed)
    }
  } catch (e) { console.error('ERR:', e.message) } finally { await prisma.$disconnect() }
})()
