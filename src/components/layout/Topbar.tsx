import { UserButton } from "@clerk/nextjs";
import { PushNotificationManager } from "@/components/items/PushNotificationManager";

export function Topbar() {
  return (
    <header className="h-16 border-b border-mist bg-surface flex items-center justify-between px-6 shrink-0">
      <div className="flex-1"></div>
      <div className="flex items-center space-x-6">
        <PushNotificationManager />
        <UserButton />
      </div>
    </header>
  )
}
