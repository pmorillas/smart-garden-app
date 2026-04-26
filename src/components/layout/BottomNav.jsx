import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Layers, CalendarDays, History, Bell } from 'lucide-react'
import clsx from 'clsx'

const NAV_ITEMS = [
  { to: '/',         icon: LayoutDashboard, label: 'Inici',    end: true },
  { to: '/zones',    icon: Layers,          label: 'Zones' },
  { to: '/programs', icon: CalendarDays,    label: 'Programes' },
  { to: '/history',  icon: History,         label: 'Historial' },
  { to: '/alerts',   icon: Bell,            label: 'Alertes' },
]

export default function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex safe-area-inset-bottom">
      {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
        <NavLink key={to} to={to} end={end} className="flex-1">
          {({ isActive }) => (
            <div className={clsx(
              'flex flex-col items-center justify-center py-2 gap-0.5 min-h-[56px] transition-colors',
              isActive ? 'text-green-600' : 'text-gray-400'
            )}>
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-tight">{label}</span>
            </div>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
