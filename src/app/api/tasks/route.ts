import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { recalculateItemProgress } from '@/lib/score'

export async function GET(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { searchParams } = new URL(req.url)
        const dateStr = searchParams.get('date')
        const goalId = searchParams.get('goalId')

        const where: any = { userId }
        if (dateStr) {
            const date = new Date(dateStr)
            date.setHours(0, 0, 0, 0)
            const nextDay = new Date(date)
            nextDay.setDate(nextDay.getDate() + 1)
            where.date = { gte: date, lt: nextDay }
        }
        if (goalId) where.goalId = goalId

        const tasks = await prisma.task.findMany({
            where,
            orderBy: { startTime: 'asc' },
            include: { goal: true }
        })

        return NextResponse.json({ tasks })
    } catch (error) {
        console.error('Failed to fetch tasks', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json()
        const { goalId, title, date, startTime, endTime, estimatedDuration, priority, categoryId, weight, reflection, isRecurring, recurrencePattern, recurrenceEnd, isFrog, isHabit } = body

        if (!goalId || !title || !date) {
            return NextResponse.json({ error: 'goalId, title, and date are required' }, { status: 400 })
        }

        // Verify the goal belongs to user
        const goal = await prisma.item.findFirst({
            where: { id: goalId, userId },
        })
        if (!goal) {
            return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
        }

        const taskWeight = weight !== undefined ? weight : 10.0

        const taskDate = new Date(date)
        const recurrenceEndDate = recurrenceEnd ? new Date(recurrenceEnd) : null

        const task = await prisma.task.create({
            data: {
                userId,
                goalId,
                categoryId: categoryId || null,
                title,
                weight: taskWeight,
                progress: 0,
                completed: false,
                date: taskDate,
                startTime: startTime ? new Date(startTime) : null,
                endTime: endTime ? new Date(endTime) : null,
                estimatedDuration: estimatedDuration || null,
                priority: priority || null,
                reflection: reflection || null,
                isRecurring: isRecurring || false,
                recurrencePattern: isRecurring ? recurrencePattern : null,
                recurrenceEnd: isRecurring && recurrenceEndDate ? recurrenceEndDate : null,
            },
        })

        // If recurring, generate additional instances
        if (isRecurring && recurrencePattern && recurrenceEndDate) {
            const instances: any[] = []
            let currentDate = new Date(taskDate)
            currentDate.setDate(currentDate.getDate() + 1)

            while (currentDate <= recurrenceEndDate) {
                let shouldCreate = false
                const day = currentDate.getDay()

                switch (recurrencePattern) {
                    case 'daily':
                        shouldCreate = true
                        break
                    case 'weekly':
                        shouldCreate = day === taskDate.getDay()
                        break
                    case 'biweekly':
                        shouldCreate = day === taskDate.getDay() && Math.floor((currentDate.getTime() - taskDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) % 2 === 0
                        break
                    case 'monthly':
                        shouldCreate = currentDate.getDate() === taskDate.getDate()
                        break
                    case 'yearly':
                        shouldCreate = currentDate.getMonth() === taskDate.getMonth() && currentDate.getDate() === taskDate.getDate()
                        break
                    case 'weekdays':
                        shouldCreate = day >= 1 && day <= 5
                        break
                    default:
                        shouldCreate = false
                }

                if (shouldCreate) {
                    instances.push(
                        prisma.task.create({
                            data: {
                                userId,
                                goalId,
                                categoryId: categoryId || null,
                                title,
                                weight: taskWeight,
                                progress: 0,
                                completed: false,
                                date: new Date(currentDate),
                                startTime: startTime ? new Date(startTime) : null,
                                endTime: endTime ? new Date(endTime) : null,
                                estimatedDuration: estimatedDuration || null,
                                priority: priority || null,
                                reflection: reflection || null,
                                isRecurring: false,
                                recurrencePattern: null,
                                recurrenceEnd: null,
                            },
                        })
                    )
                }

                currentDate.setDate(currentDate.getDate() + 1)
            }

            if (instances.length > 0) {
                await prisma.$transaction(instances)
            }
        }

        await recalculateItemProgress(goalId)

        return NextResponse.json({ success: true, task })
    } catch (error) {
        console.error('Failed to create task', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
