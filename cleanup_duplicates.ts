import prisma from './src/lib/prisma'

async function cleanup() {
    console.log('Starting duplicate cleanup...')

    // Find all task groups with same title+date+startTime
    const tasks = await prisma.task.findMany({
        where: {},
        orderBy: { date: 'asc' }
    })

    // Group by key
    const groups = new Map<string, typeof tasks>()
    for (const task of tasks) {
        const dateKey = task.date.toISOString().substring(0, 10)
        const startKey = task.startTime?.toISOString() || 'null'
        const key = `${task.userId}|${task.title}|${dateKey}|${task.goalId}|${task.isHabit}|${task.isRecurring}|${startKey}`

        if (!groups.has(key)) {
            groups.set(key, [])
        }
        groups.get(key)!.push(task)
    }

    let deleted = 0
    const deleteOps: Promise<any>[] = []

    for (const [key, group] of groups) {
        if (group.length > 1) {
            // Keep first, delete rest
            const [keep, ...toDelete] = group
            console.log(`Found ${group.length} duplicates for: ${key}`)
            console.log(`  Keeping: ${keep.id} (${keep.date.toISOString()})`)
            for (const dup of toDelete) {
                console.log(`  Deleting: ${dup.id} (${dup.date.toISOString()})`)
                deleteOps.push(prisma.task.delete({ where: { id: dup.id } }))
                deleted++
            }
        }
    }

    if (deleteOps.length > 0) {
        await Promise.all(deleteOps)
    }

    console.log(`\nCleanup complete. Deleted ${deleted} duplicate tasks.`)

    // Also fix instances that have the same date as their master task
    // (should start from next day, not same day)
    const allTasks = await prisma.task.findMany({
        where: { isRecurring: true, isHabit: false },
        orderBy: { userId: 'asc', title: 'asc', date: 'asc' }
    })

    // Group by user+title+goalId
    const taskGroups = new Map<string, typeof allTasks>()
    for (const task of allTasks) {
        const key = `${task.userId}|${task.title}|${task.goalId}`
        if (!taskGroups.has(key)) {
            taskGroups.set(key, [])
        }
        taskGroups.get(key)!.push(task)
    }

    let fixed = 0
    for (const [key, group] of taskGroups) {
        // Sort by date
        group.sort((a, b) => a.date.getTime() - b.date.getTime())
        const master = group[0]

        // Delete any instance that has the same date as the master
        const badInstances = group.filter(t => t.id !== master.id && t.date.toISOString().substring(0, 10) === master.date.toISOString().substring(0, 10))
        for (const bad of badInstances) {
            console.log(`Removing instance ${bad.id} that has same date as master ${master.id}`)
            await prisma.task.delete({ where: { id: bad.id } })
            fixed++
        }
    }

    console.log(`\nFixed ${fixed} instances with wrong dates.`)
    console.log('\nAll done!')
}

cleanup().catch(console.error)