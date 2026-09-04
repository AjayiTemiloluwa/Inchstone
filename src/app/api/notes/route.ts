import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import sanitizeHtml from 'sanitize-html'

export const dynamic = 'force-dynamic'

// Notes are authored in a Tiptap rich-text editor and rendered back with
// dangerouslySetInnerHTML (see day/[date] + notes pages), so content MUST be
// sanitized on the server — never trust the client. We strip every scriptable
// element (script, iframe, object, embed, form, video, audio …) and every
// event/attribute handler, keeping only safe rich-text.
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'strong', 'em', 'u', 's', 'blockquote', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'a', 'code', 'pre', 'span',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    span: ['class', 'style'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  allowedStyles: {
    span: {
      color: [/^(#[0-9a-fA-F]{3,8}|transparent|inherit|currentcolor)$/],
      'background-color': [/^(#[0-9a-fA-F]{3,8}|transparent|inherit|currentcolor)$/],
      'text-align': [/^(left|right|center|justify)$/],
      'font-style': [/^(normal|italic|oblique)$/],
      'font-weight': [/^(normal|bold|[1-9]00)$/],
    },
  },
}

const sanitize = (html: unknown): string => {
  if (typeof html !== 'string') return ''
  return sanitizeHtml(html, SANITIZE_OPTIONS)
}

// Absolute hard caps — guard against enormous payloads regardless of client.
const MAX_TITLE_LEN = 200
const MAX_CONTENT_LEN = 100_000

export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const dateStr = searchParams.get('date')
    const itemId = searchParams.get('itemId')

    const where: any = { userId }
    if (itemId) where.itemId = itemId
    if (dateStr) {
      const date = new Date(dateStr)
      const next = new Date(date)
      next.setDate(next.getDate() + 1)
      where.date = { gte: date, lt: next }
    }

    const notes = await prisma.note.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ notes })
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { title, content, itemId, date } = body

    // itemId, if supplied, must belong to this user — never attach a note to
    // someone else's item (defense-in-depth, mirrors the plans module).
    if (itemId) {
      const owned = await prisma.item.findFirst({
        where: { id: itemId, userId },
        select: { id: true },
      })
      if (!owned) {
        return NextResponse.json({ error: 'item not found' }, { status: 404 })
      }
    }

    const cleanTitle = sanitize(String(title || '')).slice(0, MAX_TITLE_LEN)
    const cleanContent = sanitize(String(content || '')).slice(0, MAX_CONTENT_LEN)

    const note = await prisma.note.create({
      data: {
        userId,
        title: cleanTitle,
        content: cleanContent,
        itemId: itemId || null,
        date: date ? new Date(date) : null,
      }
    })

    return NextResponse.json({ success: true, note })
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { id, title, content, itemId, date } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content
    if (itemId !== undefined) updateData.itemId = itemId
    if (date !== undefined) updateData.date = date ? new Date(date) : null

    await prisma.note.updateMany({
      where: { id, userId },
      data: updateData
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    await prisma.note.deleteMany({
      where: { id, userId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
