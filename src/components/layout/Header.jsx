import { useState } from 'react'
import { Bell, LogOut, KeyRound, X, Loader2, Check, AlertCircle } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { useAuth } from '../../hooks/useAuth.jsx'
import { changePassword } from '../../api/auth'

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

function ChangePasswordModal({ onClose }) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  async function handleSave() {
    setError(null)
    if (!form.current || !form.next || !form.confirm) {
      setError('Tots els camps són obligatoris')
      return
    }
    if (form.next.length < 8) {
      setError('La nova contrasenya ha de tenir mínim 8 caràcters')
      return
    }
    if (form.next !== form.confirm) {
      setError('Les contrasenyes noves no coincideixen')
      return
    }
    setSaving(true)
    try {
      await changePassword(form.current, form.next)
      setSuccess(true)
      setTimeout(onClose, 1500)
    } catch (e) {
      const msg = e.response?.data?.detail
      setError(msg === 'Contrasenya actual incorrecta' ? msg : "Error en canviar la contrasenya")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-gray-500" />
              <h2 className="font-semibold text-gray-900">Canviar contrasenya</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            {['current', 'next', 'confirm'].map((key) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {key === 'current' ? 'Contrasenya actual' : key === 'next' ? 'Nova contrasenya' : 'Confirmar nova contrasenya'}
                </label>
                <input
                  type="password"
                  value={form[key]}
                  onChange={e => set(key, e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                />
              </div>
            ))}

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">
                <Check className="w-4 h-4 flex-shrink-0" />
                Contrasenya canviada correctament
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel·lar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || success}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors min-w-[120px] justify-center"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Desar
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default function Header({ wsStatus }) {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const title = PAGE_TITLES[pathname] ?? 'Smart Garden'
  const ws = WS_CONFIG[wsStatus] ?? WS_CONFIG.disconnected
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  return (
    <>
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

          {/* Usuari + canvi contrasenya + logout */}
          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
              <span className="text-xs text-gray-500 hidden sm:block">{user.username}</span>
              <button
                onClick={() => setShowPasswordModal(true)}
                title="Canviar contrasenya"
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <KeyRound className="w-4 h-4" />
              </button>
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

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </>
  )
}
