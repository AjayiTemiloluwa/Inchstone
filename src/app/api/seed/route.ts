import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { addDays, startOfYear, addMonths, addWeeks } from 'date-fns'

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

    // 1. Create Default Categories
    const categories = [
      { name: 'Faith', color: '#D4AF37', icon: 'cross' },
      { name: 'Family', color: '#E8686A', icon: 'users' },
      { name: 'Fitness', color: '#7BA05B', icon: 'activity' },
      { name: 'Finance', color: '#1A1A2E', icon: 'dollar-sign' },
      { name: 'Growth', color: '#E5E0D6', icon: 'book-open' },
      { name: 'Vocation', color: '#FAF8F5', icon: 'briefcase' },
    ]
    
    for (const cat of categories) {
      await prisma.userCategory.create({
        data: { userId, ...cat }
      })
    }

    // Seed the year (2026 as per PRD)
    const yearStart = new Date(2026, 0, 1) // Jan 1, 2026

    // Layer 1: Why
    const why = await prisma.item.create({
      data: {
        userId,
        layer: 1,
        title: '2026 Identity',
        description: 'I am a disciplined steward of my time, talents, and treasure.',
        theme: 'The Year of Discipline',
        anchorScripture: 'Proverbs 16:3',
        focusQuestion: 'Did I steward today well?',
      }
    })

    // Layer 2: Quests (4 Quarters)
    for (let q = 0; q < 4; q++) {
      const qStart = addMonths(yearStart, q * 3)
      const quest = await prisma.item.create({
        data: {
          userId,
          layer: 2,
          parentId: why.id,
          title: `Q${q + 1} Quest`,
          startDate: qStart,
          endDate: addDays(addMonths(qStart, 3), -1),
          theme: `Quarter ${q + 1} Theme`,
        }
      })

      // Layer 3: Milestones (3 per Quarter)
      for (let m = 0; m < 3; m++) {
        const mStart = addMonths(qStart, m)
        const milestone = await prisma.item.create({
          data: {
            userId,
            layer: 3,
            parentId: quest.id,
            title: `Month ${q * 3 + m + 1} Milestone`,
            startDate: mStart,
            endDate: addDays(addMonths(mStart, 1), -1),
          }
        })

        // Layer 4: Wins (4 per Month - rough approximation for seeding)
        for (let w = 0; w < 4; w++) {
          const wStart = addWeeks(mStart, w)
          const win = await prisma.item.create({
            data: {
              userId,
              layer: 4,
              parentId: milestone.id,
              title: `Week ${w + 1} Win`,
              startDate: wStart,
              endDate: addDays(wStart, 6),
            }
          })

          // Layer 5: Deeds (7 per Week)
          for (let d = 0; d < 7; d++) {
            const dDate = addDays(wStart, d)
            // Just some sample deeds
            await prisma.item.create({
              data: {
                userId,
                layer: 5,
                parentId: win.id,
                title: `Daily Deed ${d + 1}`,
                startDate: dDate,
                endDate: dDate,
                weight: 1,
                category: categories[Math.floor(Math.random() * categories.length)].name,
              }
            })
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
