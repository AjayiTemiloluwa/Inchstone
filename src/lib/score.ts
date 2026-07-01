import prisma from './prisma';

/**
 * Calculates the score of a task.
 * Currently, task score could just be its weight if completed, 
 * or weight * progress (0-1).
 */
export function calculateTaskScore(task: { completed: boolean; progress: number; weight: number }) {
  if (task.completed) return task.weight;
  return (task.progress / 100) * task.weight;
}

/**
 * Re-evaluates the score for a Goal (Item) by aggregating its children (Tasks and/or child Goals).
 * Recursively bubbles up to the parent (Yearly -> Category -> Year).
 */
export async function recalculateItemProgress(itemId: string): Promise<void> {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: {
      children: true,
      tasks: true,
      parent: true
    }
  });

  if (!item) return;

  let totalWeight = 0;
  let earnedScore = 0;

  // For the lowest level (Daily Goal) or any goal that has tasks directly:
  if (item.tasks && item.tasks.length > 0) {
    for (const task of item.tasks) {
      totalWeight += task.weight;
      earnedScore += calculateTaskScore(task);
    }
  }

  // For goals that have sub-goals (e.g. Weekly Goal -> Daily Goals)
  if (item.children && item.children.length > 0) {
    for (const child of item.children) {
      totalWeight += child.weight;
      // child.progress is the percentage completed (0-100)
      earnedScore += (child.progress / 100) * child.weight;
    }
  }

  // Determine the new progress
  let newProgress = item.progress;

  // Only auto-calculate if not in manual mode
  if (item.scoreMode !== 'manual') {
    if (totalWeight > 0) {
      newProgress = (earnedScore / totalWeight) * 100;
    } else if (item.completed) {
      newProgress = 100;
    }
  }

  // Update item if changed
  if (newProgress !== item.progress) {
    await prisma.item.update({
      where: { id: item.id },
      data: { progress: newProgress }
    });

    // Bubble up to parent if in auto mode
    if (item.parentId && item.scoreMode !== 'manual') {
      await recalculateItemProgress(item.parentId);
    }
  }
}

/**
 * Sets a manual score for an item, preventing auto-calculation from children
 */
export async function setManualScore(itemId: string, score: number): Promise<void> {
  await prisma.item.update({
    where: { id: itemId },
    data: {
      progress: score,
      scoreMode: 'manual'
    }
  });

  // Bubble up to parent to recalculate (parent may still be auto)
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: { parent: true }
  });

  if (item?.parentId && item.parent?.scoreMode !== 'manual') {
    await recalculateItemProgress(item.parentId);
  }
}

/**
 * Re-enables automatic score calculation for an item
 */
export async function enableAutoScore(itemId: string): Promise<void> {
  await prisma.item.update({
    where: { id: itemId },
    data: { scoreMode: 'auto' }
  });

  // Recalculate based on children
  await recalculateItemProgress(itemId);
}
