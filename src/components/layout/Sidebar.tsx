import Link from 'next/link'
import { Home, CalendarDays, Calendar, Users, FileText, Settings } from 'lucide-react'

export function Sidebar() {
  const links = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Calendar', href: '/calendar', icon: CalendarDays },
    { name: 'Year View', href: '/year', icon: Calendar },
    { name: 'Partners', href: '/partners', icon: Users },
    { name: 'Notes', href: '/notes', icon: FileText },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

  return (
    <div className="w-64 h-full bg-surface border-r border-mist flex flex-col shrink-0">
      <div className="p-6">
        <h1 className="text-2xl font-display font-bold text-gold">Inchstone</h1>
      </div>
      <nav className="flex-1 px-4 space-y-2">
        {links.map((link) => {
          const Icon = link.icon
          return (
            <Link
              key={link.name}
              href={link.href}
              className="flex items-center px-4 py-3 text-ink hover:bg-mist hover:text-gold rounded-lg transition-colors"
            >
              <Icon className="w-5 h-5 mr-3" />
              <span className="font-medium">{link.name}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
