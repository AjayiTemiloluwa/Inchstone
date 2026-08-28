import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { sendNotification } from '@/lib/pushNotifications'

/**
 * POST /api/partners/accept  { code }
 * The invited partner taps their email link, signs in, and lands on
 * /partners/accept?code=… — this endpoint validates the invite, proves the
 * email matches, links BOTH sides, and notifies the inviter.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { code } = await req.json()
    if (!code) return NextResponse.json({ error: 'Invite code is required' }, { status: 400 })

    const me = await currentUser()
    const myEmail = me?.primaryEmailAddress?.emailAddress?.toLowerCase()
    if (!myEmail) {
      return NextResponse.json({ error: 'Your account has no email address to verify the invite with.' }, { status: 400 })
    }
    const myName = me?.firstName || me?.username || 'Your partner'

    await prisma.profile.upsert({
      where: { userId },
      update: { email: myEmail, name: myName },
      create: { userId, email: myEmail, name: myName },
    })

    const invite = await prisma.partner.findUnique({ where: { inviteCode: String(code) } })
    if (!invite || invite.status !== 'pending') {
      return NextResponse.json({ error: 'This invitation is no longer valid.' }, { status: 404 })
    }
    if (invite.email.toLowerCase() !== myEmail) {
      return NextResponse.json({ error: 'This invitation was sent to a different email address.' }, { status: 403 })
    }

    await prisma.partner.update({
      where: { id: invite.id },
      data: { status: 'accepted', connectionUserId: userId },
    })

    // Reciprocal record so both sides see each other in Partners.
    const inviterProfile = await prisma.profile.findUnique({ where: { userId: invite.userId } })
    await prisma.partner.create({
      data: {
        userId,
        name: inviterProfile?.name || 'Your partner',
        email: inviterProfile?.email || invite.email,
        role: 'Accountability Partner',
        status: 'accepted',
        connectionUserId: invite.userId,
      },
    }).catch(() => {}) // ignore duplicates

    await prisma.nudge.create({
      data: {
        partnerId: invite.id,
        senderId: userId,
        receiverId: invite.userId,
        message: `${myName} accepted your accountability-partner invite — you're linked!`,
        read: false,
      },
    })

    const subs = await prisma.pushSubscription.findMany({ where: { userId: invite.userId } })
    for (const s of subs) {
      const ok = await sendNotification(
        { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
        { title: 'Invite accepted', body: `${myName} is now your accountability partner.`, url: '/partners' },
      )
      if (!ok) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to accept partner invite:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}