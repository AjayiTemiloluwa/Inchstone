import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function POST(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { partnerId, itemId } = await req.json()

        if (!partnerId || !itemId) {
            return NextResponse.json({ error: 'partnerId and itemId are required' }, { status: 400 })
        }

        const link = await prisma.partnerLink.create({
            data: {
                partnerId,
                itemId
            }
        })

        return NextResponse.json({ success: true, link })
    } catch (error) {
        console.error('Failed to link partner:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function DELETE(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { searchParams } = new URL(req.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 })
        }

        await prisma.partnerLink.delete({
            where: { id }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to remove partner link:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
