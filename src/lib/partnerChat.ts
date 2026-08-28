import prisma from '@/lib/prisma'
import type { Partner } from '@prisma/client'

/**
 * Partner chat plumbing — the conversation model.
 *
 * Each side of a partnership owns their own Partner row (the inviter's and a
 * mirrored one for the invitee). Messages (nudges) are anchored to a single
 * **conversation row**: the earlier-created of the two. Both clients resolve
 * the same anchor from their own row, so both sides read and write one shared
 * thread no matter whose row they opened the chat from.
 */
export async function conversationAnchorId(row: Partner): Promise<string> {
  if (!row.connectionUserId) return row.id
  const theirRow = await prisma.partner.findFirst({
    where: { userId: row.connectionUserId, connectionUserId: row.userId, status: 'accepted' },
    orderBy: { createdAt: 'asc' },
  })
  if (!theirRow) return row.id
  return new Date(row.createdAt).getTime() <= new Date(theirRow.createdAt).getTime()
    ? row.id
    : theirRow.id
}

/** The shared Nudge filter for one user's view of a conversation. */
export function conversationFilter(anchorId: string, userId: string) {
  return {
    partnerId: anchorId,
    OR: [{ senderId: userId }, { receiverId: userId }],
  }
}

/** Find a Partner row owned by `ownerId` that links back to `connectionId`. */
export function findMirrorRow(ownerId: string, connectionId: string) {
  return prisma.partner.findFirst({
    where: { userId: ownerId, connectionUserId: connectionId, status: 'accepted' },
  })
}