#!/usr/bin/env node
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { PrismaClient } = require('@prisma/client')
const { PrismaNeon } = require('@prisma/adapter-neon')
const { neonConfig } = require('@neondatabase/serverless')
const ws = require('ws')
neonConfig.webSocketConstructor = ws

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) })

const USER_ID = 'user_3FdRYn5PJmNDRVa0vG9j7bfLLvz'
const TODAY = new Date(Date.UTC(2026, 10, 8)) // 2026-11-08 UTC midnight

async function main() {
  // Find daily goals (layer 6) for this user
  const dailyGoals = await prisma.item.findMany({
    where: { userId: USER_ID, layer: 6 },
    orderBy: { startDate: 'desc' },
    take: 10,
  })
  console.log('=== Daily goals (layer 6) ===')
  for (const g of dailyGoals) {
    console.log(g.id, '|', g.title, '|', g.startDate, '|', g.endDate, '| status:', g.status)
  }

  // Pick a goal: today's daily goal if exists, else the most recent daily goal
  const startOfToday = new Date(TODAY)
  const endOfToday = new Date(TODAY); endOfToday.setUTCDate(endOfToday.getUTCDate() + 1)
  let goal = await prisma.item.findFirst({
    where: {
      userId: USER_ID,
      layer: 6,
      startDate: { gte: startOfToday, lt: endOfToday },
    },
  })

  if (!goal) {
    goal = dailyGoals[0]
    console.log('No daily goal for today; falling back to most recent:', goal ? goal.title : '(none)')
  }
  if (!goal) {
    goal = await prisma.item.findFirst({ where: { userId: USER_ID }, orderBy: { createdAt: 'desc' } })
    console.log('No daily goal at all; using latest item:', goal ? goal.title : '(none)')
  }
  console.log('Using goalId:', goal ? goal.id : '(none)', '|', goal ? goal.title : '(none)')

  const frogs = [
    {
      title: 'Finish a matter of finance costs today',
      isImportant: true,
      estimatedDuration: 480, // 8 hours
      reflection: "Taking about 8 hours. Church before 7am (or not before 7am) and back home before 2pm.",
    },
    {
      title: "Attend church before 7am, back home before 2pm",
      isImportant: false,
      estimatedDuration: null,
    },
    {
      title: "Start research on climate and energy fintech space",
      isImportant: true,
      estimatedDuration: null,
      reflection: "Important research on the climate and energy fintech space.",
    },
    {
      title: "Get deep sleep; eat eba and vegetable soup and fish",
      isImportant: false,
      estimatedDuration: null,
    },
    {
      title: "Call your parents and siblings",
      isImportant: false,
      estimatedDuration: null,
    },
  ]

  const created = []
  for (const f of frogs) {
    const t = await prisma.task.create({
      data: {
        userId: USER_ID,
        goalId: goal.id,
        title: f.title,
        weight: f.isImportant ? 15.0 : 10.0,
        progress: 0,
        completed: false,
        date: TODAY,
        startTime: null,
        endTime: null,
        estimatedDuration: f.estimatedDuration,
        priority: f.isImportant ? 'high' : 'medium',
        isFrog: true,
        isHabit: false,
        isImportant: f.isImportant,
        reminderMinutes: f.isImportant ? 0 : null,
        notifyDeed: true,
        endWarnMinutes: 10,
        reflection: f.reflection || null,
      },
    })
    created.push(t)
    console.log('Created frog:', t.id, '|', t.title, '| important:', t.isImportant, '| duration:', t.estimatedDuration, 'min')
  }

  console.log('\n✔ Created', created.length, 'frogs for', TODAY.toISOString().slice(0, 10))
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
