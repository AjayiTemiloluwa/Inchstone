#!/usr/bin/env node
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { PrismaClient } = require('@prisma/client')
const { PrismaNeon } = require('@prisma/adapter-neon')
const { neonConfig } = require('@neondatabase/serverless')
const ws = require('ws')
neonConfig.webSocketConstructor = ws

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) })

async function main() {
  try {
    await prisma.$queryRawUnsafe('ALTER TABLE "Task" ALTER COLUMN "date" DROP NOT NULL')
    console.log('SUCCESS: Task.date is now nullable')
  } catch (e) {
    console.error('ERROR:', e.message)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
