import prisma from '@/lib/prisma'

export type LoggedNotification = {
  kind: string
  title: string
  body: string
  url?: string
  taskId?: string
  late?: boolean
}

/** Record a notification the server just sent, so the day's history can be scrolled back through. */
export async function logNotification(userId: string, n: LoggedNotification) {
  await prisma.notificationLog
    .create({ data: { userId, kind: n.kind, title: n.title, body: n.body, url: n.url ?? null, taskId: n.taskId ?? null, late: !!n.late } })
    .catch(() => {})
}
