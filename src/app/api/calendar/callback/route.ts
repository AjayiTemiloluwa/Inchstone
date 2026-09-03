import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import { mintTokens, getRedirectUri } from '@/lib/googleCalendar'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    const base = () => getRedirectUri(req).replace(/\/api\/calendar\/callback$/, '')

    if (error || !code) {
      return NextResponse.redirect(`${base()}/settings?calendar=error`)
    }

    const cookieStore = await cookies()
    const expectedState = cookieStore.get('google_oauth_state')?.value
    if (!expectedState || expectedState !== state) {
      return NextResponse.redirect(`${base()}/settings?calendar=error`)
    }
    const requestedMode = cookieStore.get('google_oauth_mode')?.value
    cookieStore.delete('google_oauth_state')
    cookieStore.delete('google_oauth_mode')

    const mode = await mintTokens({ userId, code, redirectUri: getRedirectUri(req), requestedMode })

    return NextResponse.redirect(
      `${base()}/settings?calendar=connected&mode=${mode === 'two' ? 'two' : 'pull'}`,
    )
  } catch (error) {
    console.error('Failed to exchange calendar code', error)
    return NextResponse.redirect(`${getRedirectUri(req).replace(/\/api\/calendar\/callback$/, '')}/settings?calendar=error`)
  }
}