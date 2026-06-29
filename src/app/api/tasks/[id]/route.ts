import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { id: taskId } = await params
        const body = await req.json()
        const { title, weight, progress, completed, scheduledTime, startTime, endTime, itemId } = body

        const task = await prisma.task.findFirst({
            where: { id: taskId, userId },
        })
        if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

        const updateData: any = {}
        if (title !== undefined) updateData.title = title
        if (weight !== undefined) updateData.weight = weight
        if (progress !== undefined) updateData.progress = progress
        if (completed !== undefined) updateData.completed = completed
        if (scheduledTime !== undefined) updateData.scheduledTime = new Date(scheduledTime)
        if (startTime !== undefined) updateData.startTime = new Date(startTime)
        if (endTime !== undefined) updateData.endTime = new Date(endTime)
        if (itemId !== undefined) updateData.itemId = itemId

        await prisma.task.update({
            where: { id: taskId },
            data: updateData,
        })

        // Recalculate deed score
        await recalculateDeedScore(task.deedId, userId)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to update task', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { id: taskId } = await params
        const task = await prisma.task.findFirst({
            where: { id: taskId, userId },
        })
        if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

        const deedId = task.deedId
        await prisma.task.delete({ where: { id: taskId } })

        // Recalculate deed score
        await recalculateDeedScore(deedId, userId)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to delete task', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

async function recalculateDeedScore(deedId: string, userId: string) {
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

    // Redistribute weights equally
    const equalWeight = 100 / tasks.length
    for (const task of tasks) {
        await prisma.task.update({
            where: { id: task.id },
            data: { weight: equalWeight },
        })
    }

    const totalWeight = tasks.reduce((s: number, t: any) => s + equalWeight, 0)
    const weightedScore = tasks.reduce((s: number, t: any) => s + (t.progress * equalWeight), 0)
    const progress = totalWeight > 0 ? (weightedScore / totalWeight) : 0
    const completed = progress >= 100

    await prisma.item.update({
        where: { id: deedId },
        data: { progress, completed },
    })
}