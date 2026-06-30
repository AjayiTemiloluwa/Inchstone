import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // Find partners owned by this user
        const partners = await prisma.partner.findMany({
            where: { userId },
            include: { partnerLinks: true }
        })

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

        if (!name || !email) {
            return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
        }

        const partner = await prisma.partner.create({
            data: {
                userId,
                name,
                email,
                role: role || 'Accountability Partner'
            }
        })

        return NextResponse.json({ success: true, partner })
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
