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
        const habit = searchParams.get('habit')

        const where: any = { userId }
        if (dateStr) {
            const date = new Date(dateStr)
            date.setHours(0, 0, 0, 0)
            const nextDay = new Date(date)
            nextDay.setDate(nextDay.getDate() + 1)
            where.date = { gte: date, lt: nextDay }
        }
        if (goalId) where.goalId = goalId
        if (habit === 'true') where.isHabit = true

        let tasks = await prisma.task.findMany({
            where,
            orderBy: { startTime: 'asc' },
            include: { goal: true }
        })

        // Deduplicate: if multiple tasks have same title, same date, and same startTime, keep only the first one
        const seen = new Set<string>()
        const deduped: typeof tasks = []
        const deletePromises: Promise<any>[] = []
        for (const task of tasks) {
            const dateKey = task.date.toISOString().substring(0, 10)
            const startKey = task.startTime?.toISOString() || 'null'
            const key = `${task.title}|${dateKey}|${task.goalId}|${startKey}`
            if (!seen.has(key)) {
                seen.add(key)
                deduped.push(task)
            } else {
                // Delete duplicate from DB
                deletePromises.push(prisma.task.delete({ where: { id: task.id } }))
            }
        }

        if (deletePromises.length > 0) {
            await Promise.all(deletePromises)
        }

        return NextResponse.json({ tasks: deduped })
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
        const { goalId, title, date, startTime, endTime, estimatedDuration, priority, categoryId, weight, color, reflection, isRecurring, recurrencePattern, recurrenceEnd, isFrog, isHabit } = body

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
        
        const startOffset = startTime ? new Date(startTime).getTime() - taskDate.getTime() : null;
        const endOffset = endTime ? new Date(endTime).getTime() - taskDate.getTime() : null;

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
                color: color || null,
                isFrog: isFrog || false,
                isHabit: isHabit || false,
            },
        })

        // If recurring, generate additional instances
        const effectiveEndDate = recurrenceEndDate || new Date(Date.UTC(new Date().getFullYear(), 11, 31, 23, 59, 59, 999))
        if (isRecurring && recurrencePattern) {
            const instances: any[] = []
            let currentDate = new Date(taskDate)
            currentDate.setUTCDate(currentDate.getUTCDate() + 1)

            while (currentDate <= effectiveEndDate) {
                let shouldCreate = false
                const day = currentDate.getUTCDay()

                switch (recurrencePattern) {
                    case 'daily':
                        shouldCreate = true
                        break
                    case 'weekly':
                        shouldCreate = day === taskDate.getUTCDay()
                        break
                    case 'biweekly':
                        shouldCreate = day === taskDate.getUTCDay() && Math.floor((currentDate.getTime() - taskDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) % 2 === 0
                        break
                    case 'monthly':
                        shouldCreate = currentDate.getUTCDate() === taskDate.getUTCDate()
                        break
                    case 'yearly':
                        shouldCreate = currentDate.getUTCMonth() === taskDate.getUTCMonth() && currentDate.getUTCDate() === taskDate.getUTCDate()
                        break
                    case 'weekdays':
                        shouldCreate = day >= 1 && day <= 5
                        break
                    default:
                        shouldCreate = false
                }

                if (shouldCreate) {
                    const instanceStartTime = startOffset !== null ? new Date(currentDate.getTime() + startOffset) : null;
                    const instanceEndTime = endOffset !== null ? new Date(currentDate.getTime() + endOffset) : null;

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
                                startTime: instanceStartTime,
                                endTime: instanceEndTime,
                                estimatedDuration: estimatedDuration || null,
                                priority: priority || null,
                                reflection: reflection || null,
                                color: color || null,
                                isRecurring: true,
                                recurrencePattern: recurrencePattern,
                                recurrenceEnd: effectiveEndDate,
                                isFrog: isFrog || false,
                                isHabit: isHabit || false,
                            },
                        })
                    )
                }

                currentDate.setUTCDate(currentDate.getUTCDate() + 1)
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
