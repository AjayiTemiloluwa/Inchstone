import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { buildWorkbook } from '@/lib/applicationSheet'

// GET /api/applications/template              — the empty Excel template
// GET /api/applications/template?filled=1     — the template pre-filled with every application
//     &tz=<getTimezoneOffset()>               — so dates show in the viewer's clock

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params = new URL(req.url).searchParams
  const filled = params.get('filled') === '1'
  const tz = Number(params.get('tz')) || 0

  const apps = filled
    ? await prisma.application.findMany({
        where: { userId, archived: false },
        orderBy: [{ deadline: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
        include: { items: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }], select: { kind: true, label: true } } },
      })
    : []

  const buf = await buildWorkbook(
    apps.map((a) => ({
      title: a.title,
      organization: a.organization ?? undefined,
      type: a.type,
      status: a.status,
      priority: a.priority,
      deadline: a.deadline,
      opensAt: a.opensAt,
      decisionDate: a.decisionDate,
      location: a.location ?? undefined,
      value: a.value ?? undefined,
      url: a.url ?? undefined,
      summary: a.summary ?? undefined,
      whyApply: a.whyApply ?? undefined,
      notes: a.notes ?? undefined,
      requirements: a.items.filter((i) => i.kind === 'eligibility').map((i) => i.label),
      documents: a.items.filter((i) => i.kind === 'document').map((i) => i.label),
      steps: a.items.filter((i) => i.kind === 'step').map((i) => i.label),
    })),
    tz,
  )

  const name = filled ? 'inchstone-applications.xlsx' : 'inchstone-application-template.xlsx'
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  })
}
