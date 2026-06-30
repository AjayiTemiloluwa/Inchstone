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

  // If no children or tasks, progress is what it is (maybe manual)
  let newProgress = item.progress;
  if (totalWeight > 0) {
    newProgress = (earnedScore / totalWeight) * 100;
  } else if (item.completed) {
    newProgress = 100;
  }

  // Update item if changed
  if (newProgress !== item.progress) {
    await prisma.item.update({
      where: { id: item.id },
      data: { progress: newProgress }
    });

    // Bubble up to parent
    if (item.parentId) {
      await recalculateItemProgress(item.parentId);
    }
  }
}
