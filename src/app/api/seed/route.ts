import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { addDays, startOfYear, addMonths, addWeeks } from 'date-fns'
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

    const categoryIds = []

    for (const cat of categoriesData) {
      const c = await prisma.item.create({
        data: {
          userId,
          layer: 1,
          parentId: year.id,
          title: cat.name,
          weight: cat.weight
        }
      })
      categoryIds.push(c.id)
    }

    // Layer 2: Yearly Goals
    const yearlyGoals = []
    for (let i = 0; i < categoryIds.length; i++) {
      const goal = await prisma.item.create({
        data: {
          userId,
          layer: 2,
          parentId: categoryIds[i],
          title: `${categoriesData[i].name} Annual Goal`,
          weight: 100, // 100% of its category, just for seed
          startDate: yearStart,
          endDate: addDays(addMonths(yearStart, 12), -1),
        }
      })
      yearlyGoals.push(goal)
    }

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const quarterMonthNames = [
      ['January', 'February', 'March'],
      ['April', 'May', 'June'],
      ['July', 'August', 'September'],
      ['October', 'November', 'December'],
    ]

    // Layer 3: Quarterly Goals
    for (const yGoal of yearlyGoals) {
      for (let q = 0; q < 4; q++) {
        const qStart = addMonths(yearStart, q * 3)
        const qGoal = await prisma.item.create({
          data: {
            userId,
            layer: 3,
            parentId: yGoal.id,
            title: `Q${q + 1} Objective`,
            weight: 25,
            startDate: qStart,
            endDate: addDays(addMonths(qStart, 3), -1),
          }
        })

        // Layer 4: Monthly Goals (3 months per quarter)
        for (let m = 0; m < 3; m++) {
          const mStart = addMonths(qStart, m)
          const monthName = quarterMonthNames[q][m]
          const mGoal = await prisma.item.create({
            data: {
              userId,
              layer: 4,
              parentId: qGoal.id,
              title: monthName,
              weight: 33.3,
              startDate: mStart,
              endDate: addDays(addMonths(mStart, 1), -1),
            }
          })

          const weeksInMonth = getWeeksInMonth(mStart.getFullYear(), mStart.getMonth() + 1)
          const perWeekWeight = Math.round((100 / weeksInMonth.length) * 10) / 10
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

          // Layer 5: Weekly Goals (actual calendar weeks)
          for (let w = 0; w < weeksInMonth.length; w++) {
            const weekDays = weeksInMonth[w]
            const wStart = weekDays[0].date
            const wEnd = weekDays[weekDays.length - 1].date
            const wGoal = await prisma.item.create({
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

            // Layer 6: Daily Goals (variable length per week)
            const perDayWeight = Math.round((100 / weekDays.length) * 10) / 10
            for (let d = 0; d < weekDays.length; d++) {
              const dDate = weekDays[d].date
              const dayName = dayNames[dDate.getDay()]
              await prisma.item.create({
                data: {
                  userId,
                  layer: 6,
                  parentId: wGoal.id,
                  title: dayName,
                  weight: perDayWeight,
                  startDate: dDate,
                  endDate: dDate,
                }
              })
            }
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
