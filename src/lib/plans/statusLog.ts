// Server-side helper: every Goal/Milestone status change must flow through here
// so the history log (§5) can never be bypassed by any UI path.
import prisma from '@/lib/prisma'

export type LogParentType = 'goal' | 'milestone'

/**
 * Validate an optional link into the yearly tracker (§8).
 * Returns the trimmed id, null (explicitly unlinked/empty), or false when the
 * referenced Item doesn't exist or isn't owned by the user.
 */
export async function validateLinkedItemId(
  userId: string,
  linkedItemId: unknown
): Promise<string | null | false> {
  const trimmed = typeof linkedItemId === 'string' ? linkedItemId.trim() : ''
  if (!trimmed) return null
  const exists = await prisma.item.findFirst({
    where: { id: trimmed, userId },
    select: { id: true },
  })
  return exists ? trimmed : false
}

export async function recordStatusChange(params: {
  userId: string
  parentType: LogParentType
  parentId: string
  oldStatus?: string | null
  newStatus: string
  note?: string | null
}): Promise<void> {
  const { userId, parentType, parentId, oldStatus, newStatus, note } = params
  const trimmedNote = note?.trim() || null
  // No-op guard: same status and nothing to say → don't spam the log
  if ((oldStatus ?? null) === newStatus && !trimmedNote) return

  await prisma.statusLogEntry.create({
    data: {
      userId,
      parentType,
      parentId,
      oldStatus: oldStatus ?? null,
      newStatus,
      note: trimmedNote,
    },
  })
}
