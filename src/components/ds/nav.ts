// Inchstone v3 navigation: the single list the sidebar, bottom nav and top bar
// all read, grouped by what the user is doing rather than alphabetically.
import {
  BarChart3,
  Calendar,
  CalendarDays,
  CalendarRange,
  DollarSign,
  FileText,
  FlaskConical,
  Home,
  Settings,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react'

export interface NavLink {
  name: string
  /** Short label for the mobile tab bar. */
  short?: string
  href: string
  icon: LucideIcon
  /** Cursor hint (data-cursor) and the More-sheet subline. */
  hint: string
  desc: string
}

export interface NavGroup {
  label: string
  links: NavLink[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Today',
    links: [
      { name: 'Dashboard', short: 'Home', href: '/dashboard', icon: Home, hint: 'Your home base', desc: 'Today at a glance' },
      { name: 'This Week', short: 'Week', href: '/week', icon: CalendarRange, hint: 'Seven days at a glance', desc: 'Plan and review the current week' },
      { name: 'Calendar', href: '/calendar', icon: CalendarDays, hint: 'Mark the days', desc: 'Every day, month by month' },
    ],
  },
  {
    label: 'Plan',
    links: [
      { name: 'Year View', short: 'Year', href: '/year', icon: Calendar, hint: 'The long view', desc: 'Quarters, months and habits for the year' },
      { name: 'Long-Term', href: '/plans', icon: Target, hint: 'Dream in decades', desc: 'Goals across months, years and decades' },
      { name: 'Challenge', href: '/challenge', icon: FlaskConical, hint: 'Fill the bottles', desc: 'Challenge bottles filled from reflections' },
    ],
  },
  {
    label: 'Money',
    links: [{ name: 'Finance', href: '/finance', icon: DollarSign, hint: 'Count your coins', desc: 'Purses, budgets and transactions' }],
  },
  {
    label: 'People & notes',
    links: [
      { name: 'Partners', href: '/partners', icon: Users, hint: 'Your people', desc: 'Accountability partners and messages' },
      { name: 'Notes', href: '/notes', icon: FileText, hint: 'Write it down', desc: 'Notes and journal entries' },
    ],
  },
  {
    label: 'Insight',
    links: [{ name: 'Reports', href: '/reports', icon: BarChart3, hint: 'See the patterns', desc: 'Progress reports and analytics' }],
  },
]

export const SETTINGS_LINK: NavLink = { name: 'Settings', href: '/settings', icon: Settings, hint: 'Make it yours', desc: 'App settings and preferences' }

export const ALL_LINKS: NavLink[] = [...NAV_GROUPS.flatMap((g) => g.links), SETTINGS_LINK]

/** Tabs on the mobile bar; everything else lives in the More sheet. */
export const MOBILE_TABS = ['/dashboard', '/finance', '/calendar', '/year']

/** Pages reached by drilling down, which are not in the nav. */
const DRILL_TITLES: Record<string, { title: string; group: string }> = {
  day: { title: 'Day', group: 'Today' },
  week: { title: 'Week', group: 'Today' },
  month: { title: 'Month', group: 'Plan' },
  quarter: { title: 'Quarter', group: 'Plan' },
  goal: { title: 'Goal', group: 'Plan' },
  transactions: { title: 'Transactions', group: 'Money' },
  reviews: { title: 'Reviews', group: 'Insight' },
}

export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(href + '/')
}

/** Title and group for the current route, for the top bar. */
export function routeMeta(pathname: string): { title: string; group?: string } {
  for (const g of NAV_GROUPS) {
    const hit = g.links.find((l) => isNavActive(pathname, l.href))
    if (hit) return { title: hit.name, group: g.label }
  }
  if (isNavActive(pathname, SETTINGS_LINK.href)) return { title: 'Settings' }
  const seg = pathname.split('/').filter(Boolean)[0] ?? 'dashboard'
  const drill = DRILL_TITLES[seg]
  if (drill) return drill
  return { title: seg.charAt(0).toUpperCase() + seg.slice(1) }
}
