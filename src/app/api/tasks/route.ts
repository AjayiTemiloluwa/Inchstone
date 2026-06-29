import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { searchParams } = new URL(req.url)
        const dateStr = searchParams.get('date')
        const deedId = searchParams.get('deedId')

        const where: any = { userId }
        if (dateStr) {
            const date = new Date(dateStr)
            date.setHours(0, 0, 0, 0)
            const nextDay = new Date(date)
            nextDay.setDate(nextDay.getDate() + 1)
            where.date = { gte: date, lt: nextDay }
        }
        if (deedId) where.deedId = deedId

        const tasks = await prisma.task.findMany({
            where,
            orderBy: { createdAt: 'asc' },
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
        const { deedId, title, date, scheduledTime, startTime, endTime, itemId } = body

        if (!deedId || !title || !date) {
            return NextResponse.json({ error: 'deedId, title, and date are required' }, { status: 400 })
        }

        // Verify the deed belongs to user
        const deed = await prisma.item.findFirst({
            where: { id: deedId, userId, layer: 5 },
        })
        if (!deed) {
            return NextResponse.json({ error: 'Deed not found' }, { status: 404 })
        }

        // Auto-calculate weight: equal distribution among siblings
        const existingTasks = await prisma.task.findMany({
            where: { deedId },
        })
        const newWeight = existingTasks.length > 0 ? 100 / (existingTasks.length + 1) : 100

        // Update existing task weights proportionally
        for (const task of existingTasks) {
            await prisma.task.update({
                where: { id: task.id },
                data: { weight: newWeight },
            })
        }

        const task = await prisma.task.create({
            data: {
                userId,
                deedId,
                title,
                weight: newWeight,
                progress: 0,
                completed: false,
                date: new Date(date),
                scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
                startTime: startTime ? new Date(startTime) : null,
                endTime: endTime ? new Date(endTime) : null,
                itemId: itemId || null,
            },
        })

        // Update deed progress
        await updateDeedScore(deedId, userId)

        return NextResponse.json({ success: true, task })
    } catch (error) {
        console.error('Failed to create task', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

async function updateDeedScore(deedId: string, userId: string) {
    const tasks = await prisma.task.findMany({
        where: { deedId },
    })

    if (tasks.length === 0) {
        await prisma.item.update({
            where: { id: deedId },
            data: { progress: 0, completed: false },
        })
        return
    }

    const totalWeight = tasks.reduce((s, t) => s + t.weight, 0)
    const weightedScore = tasks.reduce((s, t) => s + (t.progress * t.weight), 0)
    const progress = totalWeight > 0 ? (weightedScore / totalWeight) : 0
    const completed = progress >= 100

    await prisma.item.update({
        where: { id: deedId },
        data: { progress, completed },
    })
}