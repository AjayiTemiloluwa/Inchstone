import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Routes reachable WITHOUT a Clerk session. The alarm dispatcher endpoint is
// public at the Clerk layer on purpose: it authenticates itself with its own
// CRON_SECRET (x-cron-secret / Authorization: Bearer), so Clerk must not
// 404 every unauthenticated ping from external schedulers like GitHub Actions.
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/',
  '/privacy',
  '/manifest.json',
  '/sw.js',
  '/api/cron/alarms(.*)',
])

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
