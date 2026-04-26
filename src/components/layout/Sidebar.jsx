import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Layers, History, Bell, CalendarDays, Cpu, ChevronLeft, ChevronRight, Leaf } from 'lucide-react'
import clsx from 'clsx'

const NAV_ITEMS = [
  { to: '/',         icon: LayoutDashboard, label: 'Dashboard',  end: true },
  { to: '/zones',    icon: Layers,          label: 'Zones' },
  { to: '/programs', icon: CalendarDays,    label: 'Programes' },
  { to: '/history',  icon: History,         label: 'Historial' },
  { to: '/alerts',   icon: Bell,            label: 'Alertes' },
  { to: '/devices',  icon: Cpu,             label: 'Dispositius' },
]

export default function Sidebar({ collapsed, onToggle }) {
  return (
    <aside
      className={clsx(
        'hidden md:flex fixed top-0 left-0 h-screen flex-col z-40 transition-all duration-300 bg-sidebar text-white',
        collapsed ? 'w-[72px]' : 'w-[260px]'
      )}
    >
      {/* Logo */}
      <div className={clsx(
        'flex items-center gap-3 h-16 border-b border-white/10 px-4 flex-shrink-0',
        collapsed && 'justify-center px-2'
      )}>
        <div className="flex-shrink-0 w-9 h-9 bg-green-500 rounded-xl flex items-center justify-center">
          <Leaf className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="font-bold text-sm text-white leading-tight whitespace-nowrap">Smart Garden</div>
            <div className="text-xs text-gray-400 whitespace-nowrap">Sistema de reg</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-5 px-3 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <p className="text-[11px] font-semibold uppercase text-gray-500 tracking-wider px-3 mb-3">
            Navegació
          </p>
        )}
        {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={end}>
            {({ isActive }) => (
              <div className={clsx(
                'flex items-center gap-3 rounded-lg transition-colors cursor-pointer',
                collapsed ? 'justify-center p-3' : 'px-4 py-2.5',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
              )}>
                <Icon className={clsx('w-5 h-5 flex-shrink-0', isActive && 'text-green-400')} />
                {!collapsed && (
                  <span className="text-sm font-medium">{label}</span>
                )}
                {!collapsed && isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400" />
                )}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Toggle */}
      <div className="p-3 border-t border-white/10 flex-shrink-0">
        <button
          onClick={onToggle}
          title={collapsed ? 'Expandir' : 'Reduir'}
          className={clsx(
            'flex items-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white transition-colors p-2 w-full',
            collapsed ? 'justify-center' : 'justify-between px-3'
          )}
        >
          {!collapsed && <span className="text-xs">Reduir panell</span>}
          {collapsed
            ? <ChevronRight className="w-4 h-4" />
            : <ChevronLeft className="w-4 h-4" />
          }
        </button>
      </div>
    </aside>
  )
}
