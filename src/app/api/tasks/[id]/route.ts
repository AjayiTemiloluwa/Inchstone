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
        const { title, weight, progress, completed, scheduledTime, startTime, endTime, categoryId, estimatedDuration, priority, goalId, color, reflection, isFrog, isHabit, isRecurring, recurrencePattern } = body

        const task = await prisma.task.findFirst({
            where: { id: taskId, userId },
        })
        if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

        // Capture original values before any changes
        const originalTitle = task.title
        const originalGoalId = task.goalId

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
        if (isFrog !== undefined) updateData.isFrog = isFrog
        if (isHabit !== undefined) updateData.isHabit = isHabit
        if (color !== undefined) updateData.color = color
        if (isRecurring !== undefined) updateData.isRecurring = isRecurring
        if (recurrencePattern !== undefined) updateData.recurrencePattern = recurrencePattern

        await prisma.task.update({
            where: { id: taskId },
            data: updateData,
        })

        // Only regenerate instances if this is the original task AND core recurrence settings changed
        const finalIsRecurring = isRecurring !== undefined ? isRecurring : task.isRecurring
        const finalRecurrencePattern = recurrencePattern !== undefined ? recurrencePattern : task.recurrencePattern

        // Check if this is the master task (earliest instance with this title)
        const earliestSameTitle = await prisma.task.findFirst({
            where: {
                userId,
                title: originalTitle,
                goalId: originalGoalId,
            },
            orderBy: { date: 'asc' },
            select: { id: true }
        })
        const isMasterTask = earliestSameTitle?.id === taskId

        // Only regenerate if master task AND recurrence-related properties changed
        const recurrencePropsChanged = isRecurring !== undefined || recurrencePattern !== undefined || title !== undefined || startTime !== undefined || endTime !== undefined || color !== undefined || weight !== undefined || categoryId !== undefined || goalId !== undefined

        if (finalIsRecurring && finalRecurrencePattern && isMasterTask && recurrencePropsChanged) {
            // First, delete all existing future instances with same title (not isHabit to avoid deleting habits)
            const now = new Date()
            now.setHours(0, 0, 0, 0)
            const tomorrow = new Date(now)
            tomorrow.setDate(tomorrow.getDate() + 1)
            tomorrow.setHours(0, 0, 0, 0)

            await prisma.task.deleteMany({
                where: {
                    userId,
                    title: originalTitle,
                    goalId: originalGoalId,
                    isHabit: false,
                    isRecurring: true,
                    date: { gte: tomorrow },
                    id: { not: taskId },
                }
            })

            const effectiveEndDate = task.recurrenceEnd || new Date(Date.UTC(new Date().getFullYear(), 11, 31, 23, 59, 59, 999))
            const taskDate = task.date
            const instances: any[] = []
            let currentDate = new Date(taskDate)
            currentDate.setUTCDate(currentDate.getUTCDate() + 1)

            while (currentDate <= effectiveEndDate) {
                let shouldCreate = false
                const day = currentDate.getUTCDay()

                switch (finalRecurrencePattern) {
                    case 'daily': shouldCreate = true; break
                    case 'weekly': shouldCreate = day === taskDate.getUTCDay(); break
                    case 'biweekly': shouldCreate = day === taskDate.getUTCDay() && Math.floor((currentDate.getTime() - taskDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) % 2 === 0; break
                    case 'monthly': shouldCreate = currentDate.getUTCDate() === taskDate.getUTCDate(); break
                    case 'yearly': shouldCreate = currentDate.getUTCMonth() === taskDate.getUTCMonth() && currentDate.getUTCDate() === taskDate.getUTCDate(); break
                    case 'weekdays': shouldCreate = day >= 1 && day <= 5; break
                }

                if (shouldCreate) {
                    const finalStartTime = updateData.startTime !== undefined ? updateData.startTime : task.startTime;
                    const finalEndTime = updateData.endTime !== undefined ? updateData.endTime : task.endTime;
                    const startOffset = finalStartTime ? new Date(finalStartTime).getTime() - taskDate.getTime() : null;
                    const endOffset = finalEndTime ? new Date(finalEndTime).getTime() - taskDate.getTime() : null;

                    const instanceStartTime = startOffset !== null ? new Date(currentDate.getTime() + startOffset) : null;
                    const instanceEndTime = endOffset !== null ? new Date(currentDate.getTime() + endOffset) : null;

                    instances.push({
                        userId,
                        goalId: updateData.goalId !== undefined ? updateData.goalId : task.goalId,
                        categoryId: updateData.categoryId !== undefined ? updateData.categoryId : task.categoryId,
                        title: updateData.title !== undefined ? updateData.title : task.title,
                        weight: updateData.weight !== undefined ? updateData.weight : task.weight,
                        progress: 0,
                        completed: false,
                        date: new Date(currentDate),
                        startTime: instanceStartTime,
                        endTime: instanceEndTime,
                        color: updateData.color !== undefined ? updateData.color : task.color,
                        isRecurring: true,
                        recurrencePattern: finalRecurrencePattern,
                        recurrenceEnd: effectiveEndDate,
                        isFrog: updateData.isFrog !== undefined ? updateData.isFrog : task.isFrog,
                        isHabit: updateData.isHabit !== undefined ? updateData.isHabit : task.isHabit,
                    })
                }
                currentDate.setUTCDate(currentDate.getUTCDate() + 1)
            }

            if (instances.length > 0) {
                await prisma.task.createMany({ data: instances })
            }
        }

        // Recalculate goal score
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
        const { searchParams } = new URL(req.url)
        const deleteAll = searchParams.get('deleteAll') === 'true'

        const task = await prisma.task.findFirst({
            where: { id: taskId, userId },
        })
        if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

        const goalId = task.goalId

        if (deleteAll && task.isHabit) {
            // Delete all future instances of this habit (same title, from today onwards)
            const now = new Date()
            now.setHours(0, 0, 0, 0)
            await prisma.task.deleteMany({
                where: {
                    userId,
                    isHabit: true,
                    title: task.title,
                    date: { gte: now },
                }
            })
        } else {
            // Delete just this one instance
            await prisma.task.delete({ where: { id: taskId } })
        }

        // Recalculate goal score
        await recalculateItemProgress(goalId)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to delete task', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
