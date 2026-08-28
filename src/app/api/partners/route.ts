import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { sendNotification } from '@/lib/pushNotifications'
import { sendEmail, invitePartnerEmail, linkedPartnerEmail } from '@/lib/email'

export async function GET() {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // Find partners owned by this user
        const partners = await prisma.partner.findMany({
            where: { userId },
            include: { partnerLinks: true }
        })

        // Self-heal: every accepted link must have a reciprocal row on the
        // other side, so both people see each other and can chat. Repairs
        // partnerships created before mirroring existed (cheap & idempotent).
        for (const p of partners) {
            if (p.status !== 'accepted' || !p.connectionUserId) continue
            const mirror = await prisma.partner.findFirst({
                where: { userId: p.connectionUserId, connectionUserId: userId, status: 'accepted' },
            })
            if (!mirror) {
                const myProfile = await prisma.profile.findUnique({ where: { userId } })
                await prisma.partner.create({
                    data: {
                        userId: p.connectionUserId,
                        name: myProfile?.name || 'Your partner',
                        email: myProfile?.email || p.email,
                        role: p.role || 'Accountability Partner',
                        status: 'accepted',
                        connectionUserId: userId,
                    },
                }).catch(() => {})
            }
        }

        return NextResponse.json({ success: true, partners })
    } catch (error) {
        console.error('Failed to get partners:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { name, email, role } = await req.json()
        if (!name?.trim() || !email?.trim()) {
            return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
        }
        const cleanEmail = String(email).trim().toLowerCase()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
        }

        // My identity — so the partner can find and message me back.
        const me = await currentUser()
        const myEmail = me?.primaryEmailAddress?.emailAddress?.toLowerCase() || null
        const myName = me?.firstName || me?.username || 'Your partner'
        if (myEmail && cleanEmail === myEmail) {
            return NextResponse.json({ error: 'That is your own email — accountability works best with someone else.' }, { status: 400 })
        }
        if (myEmail) {
            await prisma.profile.upsert({
                where: { userId },
                update: { email: myEmail, name: myName },
                create: { userId, email: myEmail, name: myName },
            })
        }

        const inviteCode = crypto.randomUUID()
        const partner = await prisma.partner.create({
            data: {
                userId,
                name: name.trim(),
                email: cleanEmail,
                role: role || 'Accountability Partner',
                status: 'pending',
                inviteCode,
            },
        })

        // ── Linked in real time when that email is already onboarded ──
        const profile = await prisma.profile.findUnique({ where: { email: cleanEmail } })
        if (profile && profile.userId !== userId) {
            await prisma.partner.update({
                where: { id: partner.id },
                data: { status: 'accepted', connectionUserId: profile.userId },
            })
            const linked = { ...partner, status: 'accepted', connectionUserId: profile.userId }

            // Mirror the row for THEM so their Partners page shows you and
            // their chat opens on the same thread — without this they never
            // see they were added.
            const existingMirror = await prisma.partner.findFirst({
                where: { userId: profile.userId, connectionUserId: userId, status: 'accepted' },
            })
            if (!existingMirror) {
                await prisma.partner.create({
                    data: {
                        userId: profile.userId,
                        name: myName,
                        email: myEmail || '',
                        role: partner.role || 'Accountability Partner',
                        status: 'accepted',
                        connectionUserId: userId,
                    },
                }).catch(() => {})
            }

            await prisma.nudge.create({
                data: {
                    partnerId: partner.id,
                    senderId: userId,
                    receiverId: profile.userId,
                    message: `${name.trim()} added you as their accountability partner — you can now cheer them on and message each other.`,
                    read: false,
                },
            })

            const subs = await prisma.pushSubscription.findMany({ where: { userId: profile.userId } })
            for (const s of subs) {
                const ok = await sendNotification(
                    { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
                    { title: 'Accountability partner linked', body: `${name.trim()} linked with you on Inchstone.`, url: '/partners' },
                )
                if (!ok) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {})
            }

            const tpl = linkedPartnerEmail(myName, name.trim())
            const emailSent = await sendEmail({ to: cleanEmail, subject: tpl.subject, html: tpl.html })

            return NextResponse.json({ success: true, partner: linked, linked: true, emailSent })
        }

        // ── Not onboarded yet → respectful invite email with an accept link ──
        const origin = new URL(req.url).origin
        const acceptUrl = `${origin}/partners/accept?code=${inviteCode}`
        const tpl = invitePartnerEmail(myName, acceptUrl)
        const emailSent = await sendEmail({ to: cleanEmail, subject: tpl.subject, html: tpl.html })

        // `emailSent` lets the UI fall back to a copyable invite link when the
        // mail provider isn't configured (no RESEND_API_KEY) or refuses the
        // send — the invite still works, it just travels by another channel.
        return NextResponse.json({ success: true, partner, linked: false, emailSent, acceptUrl })
    } catch (error) {
        console.error('Failed to create partner:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function DELETE(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { searchParams } = new URL(req.url)
        const partnerId = searchParams.get('id')

        if (!partnerId) {
            return NextResponse.json({ error: 'Partner ID is required' }, { status: 400 })
        }

        await prisma.partner.delete({
            where: { id: partnerId, userId }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to delete partner:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
