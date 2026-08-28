import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { recalculateItemProgress } from '@/lib/score'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { id: taskId } = await params
        const body = await req.json()
        const { title, weight, progress, completed, scheduledTime, startTime, endTime, categoryId, estimatedDuration, priority, goalId, color, reflection, isFrog, isHabit, isRecurring, recurrencePattern, isImportant, reminderMinutes, notifyDeed, endWarnMinutes } = body

        const task = await prisma.task.findFirst({
            where: { id: taskId, userId },
        })
        if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

        // Capture original values before any changes
        const originalTitle = task.title
        const originalGoalId = task.goalId

        const updateData: Prisma.TaskUpdateInput = {}
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
        if (goalId !== undefined) updateData.goal = { connect: { id: goalId } }
        if (reflection !== undefined) updateData.reflection = reflection
        if (isFrog !== undefined) updateData.isFrog = isFrog
        if (isHabit !== undefined) updateData.isHabit = isHabit
        if (isImportant !== undefined) updateData.isImportant = isImportant
        if (reminderMinutes !== undefined) updateData.reminderMinutes = reminderMinutes
        if (notifyDeed !== undefined) updateData.notifyDeed = notifyDeed
        if (endWarnMinutes !== undefined) updateData.endWarnMinutes = endWarnMinutes
        // Re-arm notifications whenever the schedule or reminder changed —
        // clearing the stamps lets the countdown / reminder / start / ending /
        // finish notifications fire again against the new times.
        if (
            startTime !== undefined ||
            endTime !== undefined ||
            reminderMinutes !== undefined ||
            isImportant !== undefined ||
            notifyDeed !== undefined ||
            endWarnMinutes !== undefined
        ) {
            updateData.reminderNotifiedAt = null
            updateData.startNotifiedAt = null
            updateData.countdownNotifiedAt = null
            updateData.finishNotifiedAt = null
            updateData.endingNotifiedAt = null
        }
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
            const instances: Prisma.TaskCreateManyInput[] = []
            const currentDate = new Date(taskDate)
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
                    const finalStartTime = startTime !== undefined ? startTime : task.startTime;
                    const finalEndTime = endTime !== undefined ? endTime : task.endTime;
                    const startOffset = finalStartTime ? new Date(finalStartTime as string).getTime() - taskDate.getTime() : null;
                    const endOffset = finalEndTime ? new Date(finalEndTime as string).getTime() - taskDate.getTime() : null;

                    const instanceStartTime = startOffset !== null ? new Date(currentDate.getTime() + startOffset) : null;
                    const instanceEndTime = endOffset !== null ? new Date(currentDate.getTime() + endOffset) : null;

                    instances.push({
                        userId,
                        goalId: goalId !== undefined ? goalId : task.goalId,
                        categoryId: categoryId !== undefined ? categoryId : task.categoryId,
                        title: title !== undefined ? title : task.title,
                        weight: weight !== undefined ? weight : task.weight,
                        progress: 0,
                        completed: false,
                        date: new Date(currentDate),
                        startTime: instanceStartTime,
                        endTime: instanceEndTime,
                        color: color !== undefined ? color : task.color,
                        isRecurring: true,
                        recurrencePattern: finalRecurrencePattern,
                        recurrenceEnd: effectiveEndDate,
                        isFrog: isFrog !== undefined ? isFrog : task.isFrog,
                        isHabit: isHabit !== undefined ? isHabit : task.isHabit,
                        isImportant: isImportant !== undefined ? isImportant : task.isImportant,
                        reminderMinutes: reminderMinutes !== undefined ? reminderMinutes : task.reminderMinutes,
                        notifyDeed: notifyDeed !== undefined ? notifyDeed : task.notifyDeed,
                        endWarnMinutes: endWarnMinutes !== undefined ? endWarnMinutes : task.endWarnMinutes,
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
