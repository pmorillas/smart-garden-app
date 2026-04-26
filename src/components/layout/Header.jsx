import { Bell, LogOut } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { useAuth } from '../../hooks/useAuth.jsx'

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/zones': 'Zones',
  '/programs': 'Programes',
  '/history': 'Historial',
  '/alerts': 'Alertes',
  '/devices': 'Dispositius',
}

const WS_CONFIG = {
  connected:    { dot: 'bg-green-500',               text: 'Connectat',    color: 'text-green-700' },
  connecting:   { dot: 'bg-yellow-400 animate-pulse', text: 'Connectant…', color: 'text-yellow-700' },
  disconnected: { dot: 'bg-red-500',                 text: 'Desconnectat', color: 'text-red-600' },
}

export default function Header({ wsStatus }) {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const title = PAGE_TITLES[pathname] ?? 'Smart Garden'
  const ws = WS_CONFIG[wsStatus] ?? WS_CONFIG.disconnected

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-6 bg-white border-b border-gray-200">
      <div>
        <h1 className="text-base font-semibold text-gray-900">{title}</h1>
        <p className="text-xs text-gray-400 hidden sm:block">Smart Garden — Sistema de reg automàtic</p>
      </div>
      <div className="flex items-center gap-3">
        {/* WS status */}
        <div className="hidden sm:flex items-center gap-2">
          <span className={clsx('w-2 h-2 rounded-full', ws.dot)} />
          <span className={clsx('text-xs font-medium', ws.color)}>{ws.text}</span>
        </div>

        {/* Alertes */}
        <button className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
          <Bell className="w-4.5 h-4.5" />
        </button>

        {/* Usuari + logout */}
        {user && (
          <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
            <span className="text-xs text-gray-500 hidden sm:block">{user.username}</span>
            <button
              onClick={logout}
              title="Tancar sessió"
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-red-600 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
