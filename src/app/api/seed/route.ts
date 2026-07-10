import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { addDays, addMonths } from 'date-fns'
import { getWeeksInMonth } from '@/lib/calendarUtils'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user already has items
    const existing = await prisma.item.findFirst({ where: { userId } })
    if (existing) {
      return NextResponse.json({ error: 'Framework already seeded' }, { status: 400 })
    }

    const yearStart = new Date(2026, 0, 1) // Jan 1, 2026

    // Layer 0: Year (Master Dashboard)
    const year = await prisma.item.create({
      data: {
        userId,
        layer: 0,
        title: '2026 Identity',
        description: 'I am a disciplined steward of my time, talents, and treasure.',
        theme: 'The Year of Discipline',
        anchorScripture: 'Proverbs 16:3',
        focusQuestion: 'Did I steward today well?',
      }
    })

    // Layer 1: Categories
    const categoriesData = [
      { name: 'Faith', weight: 5 },
      { name: 'Family', weight: 10 },
      { name: 'Fitness', weight: 20 },
      { name: 'Finance', weight: 15 },
      { name: 'Career', weight: 35 },
      { name: 'Learning', weight: 15 },
    ]

    // Create all categories
    const categories = await Promise.all(
      categoriesData.map(cat =>
        prisma.item.create({
          data: { userId, layer: 1, parentId: year.id, title: cat.name, weight: cat.weight }
        })
      )
    )

    const quarterMonthNames = [
      ['January', 'February', 'March'],
      ['April', 'May', 'June'],
      ['July', 'August', 'September'],
      ['October', 'November', 'December'],
    ]

    // Layer 2: Yearly Goals
    const yearlyGoals = await Promise.all(
      categories.map((cat, i) =>
        prisma.item.create({
          data: {
            userId,
            layer: 2,
            parentId: cat.id,
            title: `${categoriesData[i].name} Annual Goal`,
            weight: 100,
            startDate: yearStart,
            endDate: addDays(addMonths(yearStart, 12), -1),
          }
        })
      )
    )

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    for (let ci = 0; ci < yearlyGoals.length; ci++) {
      // Layer 3: Quarterly Goals
      const quarterRecords = await Promise.all(
        [0, 1, 2, 3].map(q => {
          const qStart = addMonths(yearStart, q * 3)
          return prisma.item.create({
            data: {
              userId,
              layer: 3,
              parentId: yearlyGoals[ci].id,
              title: `Q${q + 1} Objective`,
              weight: 25,
              startDate: qStart,
              endDate: addDays(addMonths(qStart, 3), -1),
            }
          })
        })
      )

      for (let q = 0; q < 4; q++) {
        for (let m = 0; m < 3; m++) {
          const mStart = addMonths(addMonths(yearStart, q * 3), m)
          const monthName = quarterMonthNames[q][m]

          // Layer 4: Monthly Goal
          const mGoal = await prisma.item.create({
            data: {
              userId,
              layer: 4,
              parentId: quarterRecords[q].id,
              title: monthName,
              weight: 33.3,
              startDate: mStart,
              endDate: addDays(addMonths(mStart, 1), -1),
            }
          })

          const weeksInMonth = getWeeksInMonth(mStart.getFullYear(), mStart.getMonth() + 1)
          const perWeekWeight = Math.round((100 / weeksInMonth.length) * 10) / 10

          // Layer 5: Weekly Goals
          const weekRecords = await Promise.all(
            weeksInMonth.map((weekDays, w) => {
              const wStart = weekDays[0].date
              const wEnd = weekDays[weekDays.length - 1].date
              return prisma.item.create({
                data: {
                  userId,
                  layer: 5,
                  parentId: mGoal.id,
                  title: `Week ${w + 1}`,
                  weight: perWeekWeight,
                  startDate: wStart,
                  endDate: wEnd,
                }
              })
            })
          )

          // Layer 6: Daily Goals - bulk insert in batches
          const dayBatch: any[] = []
          for (let w = 0; w < weeksInMonth.length; w++) {
            const weekDays = weeksInMonth[w]
            const perDayWeight = Math.round((100 / weekDays.length) * 10) / 10

            for (let d = 0; d < weekDays.length; d++) {
              const dDate = weekDays[d].date
              const dayName = dayNames[dDate.getDay()]
              dayBatch.push({
                userId,
                layer: 6,
                parentId: weekRecords[w].id,
                title: dayName,
                weight: perDayWeight,
                startDate: dDate,
                endDate: dDate,
              })
            }
          }

          for (let i = 0; i < dayBatch.length; i += 100) {
            await prisma.item.createMany({ data: dayBatch.slice(i, i + 100) })
          }
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to seed', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
