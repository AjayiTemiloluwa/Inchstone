import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'
import { buildAuthUrl, getRedirectUri, googleConfigured } from '@/lib/googleCalendar'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!googleConfigured()) {
      return NextResponse.json(
        { error: 'Calendar sync is not configured — add GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET to your environment.' },
        { status: 503 },
      )
    }

    const url = new URL(req.url)
    const mode = url.searchParams.get('mode') === 'two' ? 'two' : 'pull'
    const state = randomBytes(24).toString('hex')
    const cookieStore = await cookies()
    cookieStore.set('google_oauth_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    })
    cookieStore.set('google_oauth_mode', mode, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    })

    return NextResponse.json({
      url: buildAuthUrl({ mode, state, redirectUri: getRedirectUri(req) }),
      redirect_uri: getRedirectUri(req),
    })

  } catch (error) {
    console.error('Failed to build calendar auth url', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}