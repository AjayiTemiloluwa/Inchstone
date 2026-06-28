import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { searchParams } = new URL(req.url)
        const dateStr = searchParams.get('date')

        if (!dateStr) {
            return NextResponse.json({ error: 'date is required' }, { status: 400 })
        }

        const date = new Date(dateStr)
        date.setHours(0, 0, 0, 0)
        const nextDay = new Date(date)
        nextDay.setDate(nextDay.getDate() + 1)

        // Get tasks for the day
        const tasks = await prisma.event.findMany({
            where: {
                userId,
                type: 'task',
                startTime: { gte: date, lt: nextDay },
            },
            orderBy: { scheduledTime: 'asc' },
        })

        // Get or create daily score
        let dailyScore = await prisma.dailyScore.findUnique({
            where: { userId_date: { userId, date } },
        })

        if (!dailyScore) {
            dailyScore = await prisma.dailyScore.create({
                data: {
                    userId,
                    date,
                    totalTasks: tasks.length,
                    completedTasks: tasks.filter(t => t.completed).length,
                    score: tasks.length > 0
                        ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100)
                        : 0,
                },
            })
        }

        return NextResponse.json({
            tasks: tasks.map(t => ({
                id: t.id,
                title: t.title,
                scheduledTime: t.scheduledTime?.toISOString() || null,
                completed: t.completed,
                score: t.score,
            })),
            dailyScore: {
                totalTasks: dailyScore.totalTasks,
                completedTasks: dailyScore.completedTasks,
                score: dailyScore.score,
            },
        })
    } catch (error) {
        console.error('Failed to fetch daily score', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json()
        const { title, scheduledTime, date } = body

        if (!title || !date) {
            return NextResponse.json({ error: 'title and date are required' }, { status: 400 })
        }

        const startDate = new Date(date)
        startDate.setHours(0, 0, 0, 0)
        const endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + 1)

        const event = await prisma.event.create({
            data: {
                userId,
                title,
                type: 'task',
                startTime: startDate,
                endTime: endDate,
                scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
                completed: false,
            },
        })

        // Update daily score
        const tasks = await prisma.event.findMany({
            where: {
                userId,
                type: 'task',
                startTime: { gte: startDate, lt: endDate },
            },
        })

        const totalTasks = tasks.length
        const completedTasks = tasks.filter(t => t.completed).length
        const score = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

        await prisma.dailyScore.upsert({
            where: { userId_date: { userId, date: startDate } },
            update: { totalTasks, completedTasks, score },
            create: { userId, date: startDate, totalTasks, completedTasks, score },
        })

        return NextResponse.json({
            success: true,
            task: {
                id: event.id,
                title: event.title,
                scheduledTime: event.scheduledTime?.toISOString() || null,
                completed: event.completed,
            },
            dailyScore: { totalTasks, completedTasks, score },
        })
    } catch (error) {
        console.error('Failed to create task', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function PUT(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json()
        const { id, completed, title, scheduledTime } = body

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 })
        }

        const updateData: any = {}
        if (completed !== undefined) updateData.completed = completed
        if (title !== undefined) updateData.title = title
        if (scheduledTime !== undefined) updateData.scheduledTime = new Date(scheduledTime)

        const updated = await prisma.event.updateMany({
            where: { id, userId, type: 'task' },
            data: updateData,
        })

        if (updated.count > 0) {
            // Recalculate daily score
            const task = await prisma.event.findUnique({ where: { id } })
            if (task) {
                const date = new Date(task.startTime)
                date.setHours(0, 0, 0, 0)
                const nextDay = new Date(date)
                nextDay.setDate(nextDay.getDate() + 1)

                const tasks = await prisma.event.findMany({
                    where: {
                        userId,
                        type: 'task',
                        startTime: { gte: date, lt: nextDay },
                    },
                })

                const totalTasks = tasks.length
                const completedTasks = tasks.filter(t => t.completed).length
                const score = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

                await prisma.dailyScore.upsert({
                    where: { userId_date: { userId, date } },
                    update: { totalTasks, completedTasks, score },
                    create: { userId, date, totalTasks, completedTasks, score },
                })

                return NextResponse.json({
                    success: true,
                    dailyScore: { totalTasks, completedTasks, score },
                })
            }
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to update task', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function DELETE(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json()
        const { id } = body

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 })
        }

        const task = await prisma.event.findUnique({ where: { id } })
        if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

        await prisma.event.deleteMany({
            where: { id, userId, type: 'task' },
        })

        // Recalculate daily score
        const date = new Date(task.startTime)
        date.setHours(0, 0, 0, 0)
        const nextDay = new Date(date)
        nextDay.setDate(nextDay.getDate() + 1)

        const tasks = await prisma.event.findMany({
            where: {
                userId,
                type: 'task',
                startTime: { gte: date, lt: nextDay },
            },
        })

        const totalTasks = tasks.length
        const completedTasks = tasks.filter(t => t.completed).length
        const score = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

        await prisma.dailyScore.upsert({
            where: { userId_date: { userId, date } },
            update: { totalTasks, completedTasks, score },
            create: { userId, date, totalTasks, completedTasks, score },
        })

        return NextResponse.json({ success: true, dailyScore: { totalTasks, completedTasks, score } })
    } catch (error) {
        console.error('Failed to delete task', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}