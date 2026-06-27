import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'

export default async function Home() {
  const { userId } = await auth()
  
  if (userId) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-5xl font-display font-bold text-gold mb-6">Inchstone</h1>
      <p className="text-xl text-ink/80 max-w-2xl mb-12">
        Small, consistent actions compound into significant transformation. 
        Your daily deeds should flow from your yearly vision.
      </p>
      <a href="/sign-in" className="px-8 py-4 bg-ink text-surface font-bold rounded-xl hover:bg-ink/90 transition shadow-lg">
        Start Your Journey
      </a>
    </div>
  )
}
