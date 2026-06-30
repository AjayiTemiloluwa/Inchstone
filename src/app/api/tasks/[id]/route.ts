import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { recalculateItemProgress } from '@/lib/score'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { id: taskId } = await params
        const body = await req.json()
        const { title, weight, progress, completed, scheduledTime, startTime, endTime, categoryId, estimatedDuration, priority, goalId, reflection } = body

        const task = await prisma.task.findFirst({
            where: { id: taskId, userId },
        })
        if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

        const updateData: any = {}
        if (title !== undefined) updateData.title = title
        if (weight !== undefined) updateData.weight = weight
        if (progress !== undefined) updateData.progress = progress
        if (completed !== undefined) updateData.completed = completed
        if (scheduledTime !== undefined) updateData.scheduledTime = scheduledTime ? new Date(scheduledTime) : null
        if (startTime !== undefined) updateData.startTime = startTime ? new Date(startTime) : null
        if (endTime !== undefined) updateData.endTime = endTime ? new Date(endTime) : null
        if (categoryId !== undefined) updateData.categoryId = categoryId
        if (estimatedDuration !== undefined) updateData.estimatedDuration = estimatedDuration
        if (priority !== undefined) updateData.priority = priority
        if (goalId !== undefined) updateData.goalId = goalId
        if (reflection !== undefined) updateData.reflection = reflection

        await prisma.task.update({
            where: { id: taskId },
            data: updateData,
        })

        // Recalculate goal score
        // Use the new goalId if updated, otherwise the old one
        const finalGoalId = goalId !== undefined ? goalId : task.goalId
        await recalculateItemProgress(finalGoalId)

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

        const goalId = task.goalId
        await prisma.task.delete({ where: { id: taskId } })

        // Recalculate goal score
        await recalculateItemProgress(goalId)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to delete task', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}