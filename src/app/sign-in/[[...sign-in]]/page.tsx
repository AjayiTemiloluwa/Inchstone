import { SignIn } from '@clerk/nextjs'

export default function Page() {
  return (
    <div className="min-h-dvh bg-paper flex items-center justify-center px-3 py-6 sm:p-6 overflow-x-hidden">
      <SignIn />
    </div>
  )
}
