import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { Compass } from '@/components/ui/Compass'

export default async function Home() {
  const { userId } = await auth()

  if (userId) {
    redirect('/dashboard')
  }

  return (
    <div className="relative min-h-screen bg-paper flex flex-col items-center justify-center px-6 text-center py-[8vh]">
      <a
        href="/privacy"
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm text-parchment/40 transition-colors hover:text-gold"
      >
        Privacy
      </a>
      <div className="flex flex-col items-center max-w-[720px]">
        {/* Compass finds north first (needs settle on mount) */}
        <Compass alignment={100} ringProgress={0} size={160} className="mb-10" />

        {/* Wordmark — Playfair, display size */}
        <h1 className="text-display font-display text-parchment">Inchstone</h1>

        {/* Subline */}
        <p className="mt-6 text-body text-parchment/70 leading-relaxed max-w-lg">
          Small, consistent actions compound into significant transformation. Your daily deeds
          should flow from your yearly vision.
        </p>

        {/* One CTA — gold, no gradient, no shadow */}
        <a
          href="/sign-in"
          className="mt-12 inline-flex min-h-12 items-center justify-center px-8 py-3 rounded-md bg-gold text-ink text-body font-semibold transition-colors hover:bg-[#cbaa6f]"
        >
          Start Your Journey
        </a>
      </div>
    </div>
  )
}

