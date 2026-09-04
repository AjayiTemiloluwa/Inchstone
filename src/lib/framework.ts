/**
 * Framework provisioning — the structural skeleton of every year workspace.
 *
 * A "framework" is the Item hierarchy the whole app is built around:
 *   layer 0: Year      — the workspace itself ("2026")
 *   layer 1: Category  — Faith, Family, Fitness, Finance, Career, Learning
 *   layer 2: Yearly goal
 *   layer 3: Quarterly objective
 *   layer 4: Monthly goal
 *   layer 5: Weekly goal
 *   layer 6: Daily goal
 *
 * New users never seed anything by hand: the framework for the year "as the
 * day is" (the current calendar year) is provisioned automatically the first
 * time their data loads (GET /api/items), and any other year gets the same
 * full structure the moment it is opened (POST /api/years). Everything lives
 * in the remote database, so the structure is available on every device as
 * soon as the user signs in.
 */
import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { addDays, addMonths } from 'date-fns'
import { getWeeksInMonth } from '@/lib/calendarUtils'

/** The standard category skeleton every year starts with. */
export const DEFAULT_CATEGORIES = [
  { name: 'Faith', weight: 5 },
  { name: 'Family', weight: 10 },
  { name: 'Fitness', weight: 20 },
  { name: 'Finance', weight: 15 },
  { name: 'Career', weight: 35 },
  { name: 'Learning', weight: 15 },
]

const QUARTER_MONTH_NAMES = [
  ['January', 'February', 'March'],
  ['April', 'May', 'June'],
  ['July', 'August', 'September'],
  ['October', 'November', 'December'],
]

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type FrameworkRow = {
  id: string
  userId: string
  layer: number
  parentId: string | null
  title: string
  weight: number
  startDate?: Date
  endDate?: Date
  description?: string
  theme?: string
  anchorScripture?: string
  focusQuestion?: string
}

/**
 * Finds the layer-0 workspace for `year`. Matches BOTH plain year workspaces
 * (startDate inside the year) and renamed ones ("2026 Identity") that carry
 * the year in their title with no dates — missing the title case is exactly
 * how duplicate 2026 workspaces were born.
 */
export async function findYearItem(userId: string, year: number) {
  const years = await prisma.item.findMany({ where: { userId, layer: 0 } })
  return (
    years.find(i => {
      if (i.startDate) {
        const sd = new Date(i.startDate)
        if (!Number.isNaN(sd.getTime()) && sd.getFullYear() === year) return true
      }
      const m = (i.title || '').match(/\b(1[89]\d{2}|20\d{2})\b/)
      return m ? Number(m[1]) === year : false
    }) ?? null
  )
}

/** True once the user has any year workspace at all. */
async function hasYearWorkspace(userId: string): Promise<boolean> {
  const existing = await prisma.item.findFirst({
    where: { userId, layer: 0 },
    select: { id: true },
  })
  return existing !== null
}

/**
 * Seeds the COMPLETE framework for `year`: the layer-0 workspace, the
 * category skeleton, and every yearly → quarterly → monthly → weekly →
 * daily goal beneath each category. All date windows derive from the year
 * number, so a framework seeded in 2027 is a genuine 2027 framework — the
 * structure always matches the year the day is in, never a hardcoded one.
 *
 * Rows are generated with pre-built ids and inserted top-down (parents
 * before children, satisfying the self-relation FK) in batched createMany
 * calls — ~2.6k rows land in a handful of round trips against the remote
 * database instead of thousands of individual inserts.
 */
export async function seedYearFramework(userId: string, year: number) {
  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999)

  const rows: FrameworkRow[] = []

  // Layer 0: Year (Master Dashboard)
  const yearId = randomUUID()
  rows.push({
    id: yearId,
    userId,
    layer: 0,
    parentId: null,
    title: String(year),
    weight: 1,
    description: 'A year of turning modest, daily choices into a life of quiet excellence.',
    theme: 'Discipline & Deliberate Growth',
    anchorScripture: 'Discipline is the quiet art of keeping your promises to yourself.',
    focusQuestion: 'Did I grow a little closer to who I want to be today?',
    startDate: yearStart,
    endDate: yearEnd,
  })

  // Layer 1: Categories
  const categoryIds: string[] = []
  for (const cat of DEFAULT_CATEGORIES) {
    const id = randomUUID()
    categoryIds.push(id)
    rows.push({
      id,
      userId,
      layer: 1,
      parentId: yearId,
      title: cat.name,
      weight: cat.weight,
      startDate: yearStart,
      endDate: yearEnd,
    })
  }

  // Layers 2–6 for every category.
  for (let ci = 0; ci < categoryIds.length; ci++) {
    const categoryName = DEFAULT_CATEGORIES[ci].name

    // Layer 2: Yearly Goal
    const yearlyGoalId = randomUUID()
    rows.push({
      id: yearlyGoalId,
      userId,
      layer: 2,
      parentId: categoryIds[ci],
      title: `${categoryName} Annual Goal`,
      weight: 100,
      startDate: yearStart,
      endDate: yearEnd,
    })

    // Layer 3: Quarterly Goals
    const quarterIds: string[] = []
    for (let q = 0; q < 4; q++) {
      const qStart = addMonths(yearStart, q * 3)
      const id = randomUUID()
      quarterIds.push(id)
      rows.push({
        id,
        userId,
        layer: 3,
        parentId: yearlyGoalId,
        title: `Q${q + 1} Objective`,
        weight: 25,
        startDate: qStart,
        endDate: addDays(addMonths(qStart, 3), -1),
      })
    }

    for (let q = 0; q < 4; q++) {
      for (let m = 0; m < 3; m++) {
        const mStart = addMonths(addMonths(yearStart, q * 3), m)

        // Layer 4: Monthly Goal
        const monthGoalId = randomUUID()
        rows.push({
          id: monthGoalId,
          userId,
          layer: 4,
          parentId: quarterIds[q],
          title: QUARTER_MONTH_NAMES[q][m],
          weight: 33.3,
          startDate: mStart,
          endDate: addDays(addMonths(mStart, 1), -1),
        })

        const weeksInMonth = getWeeksInMonth(mStart.getFullYear(), mStart.getMonth() + 1)
        const perWeekWeight = Math.round((100 / weeksInMonth.length) * 10) / 10

        // Layer 5: Weekly Goals
        const weekIds: string[] = []
        for (let w = 0; w < weeksInMonth.length; w++) {
          const weekDays = weeksInMonth[w]
          const id = randomUUID()
          weekIds.push(id)
          rows.push({
            id,
            userId,
            layer: 5,
            parentId: monthGoalId,
            title: `Week ${w + 1}`,
            weight: perWeekWeight,
            startDate: weekDays[0].date,
            endDate: weekDays[weekDays.length - 1].date,
          })
        }

        // Layer 6: Daily Goals
        for (let w = 0; w < weeksInMonth.length; w++) {
          const weekDays = weeksInMonth[w]
          const perDayWeight = Math.round((100 / weekDays.length) * 10) / 10
          for (let d = 0; d < weekDays.length; d++) {
            const dDate = weekDays[d].date
            rows.push({
              id: randomUUID(),
              userId,
              layer: 6,
              parentId: weekIds[w],
              title: DAY_NAMES[dDate.getDay()],
              weight: perDayWeight,
              startDate: dDate,
              endDate: dDate,
            })
          }
        }
      }
    }
  }

  // Top-down batches: every parent lands before its children (FK-safe).
  const BATCH_SIZE = 500
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await prisma.item.createMany({ data: rows.slice(i, i + BATCH_SIZE) })
  }

  return {
    id: yearId,
    userId,
    layer: 0,
    parentId: null,
    title: String(year),
    description: 'A year of turning modest, daily choices into a life of quiet excellence.',
    weight: 1,
    status: 'active',
    completed: false,
    progress: 0,
    startDate: yearStart,
    endDate: yearEnd,
    theme: 'Discipline & Deliberate Growth',
    anchorScripture: 'Discipline is the quiet art of keeping your promises to yourself.',
    focusQuestion: 'Did I grow a little closer to who I want to be today?',
  }
}

/**
 * One seed in flight per user, per server process — parallel first loads
 * coalesce into a single seed instead of racing into duplicate workspaces.
 */
const ensureLocks = new Map<string, Promise<boolean>>()

/**
 * Auto-provisioning for NEW users: if the user has no year workspace at all,
 * seed the full framework for the current calendar year ("as the day is").
 * Idempotent — existing users are skipped after one cheap findFirst, and the
 * in-flight lock means concurrent first loads seed exactly once.
 */
export async function ensureCurrentYearFramework(userId: string): Promise<boolean> {
  if (await hasYearWorkspace(userId)) return false

  const inflight = ensureLocks.get(userId)
  if (inflight) return inflight

  const task = (async () => {
    // Re-check inside the lock: a parallel request may have seeded already.
    if (await hasYearWorkspace(userId)) return false
    await seedYearFramework(userId, new Date().getFullYear())
    return true
  })()

  ensureLocks.set(userId, task)
  try {
    return await task
  } finally {
    if (ensureLocks.get(userId) === task) ensureLocks.delete(userId)
  }
}