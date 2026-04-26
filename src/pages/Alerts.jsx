import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, XCircle, Info, CheckCircle, Bell, BellOff, Loader2, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { fetchAlerts, resolveAlert, deleteAlert } from '../api/alerts'
import { getVapidPublicKey, saveSubscription, deleteSubscription, urlBase64ToUint8Array } from '../api/push'

const STYLES = {
  humidity_low:    { Icon: AlertTriangle, border: 'border-l-yellow-400', bg: 'bg-yellow-50', icon: 'text-yellow-500', badge: 'bg-yellow-100 text-yellow-700', label: 'Humitat baixa' },
  device_offline:  { Icon: XCircle,       border: 'border-l-red-400',    bg: 'bg-red-50',    icon: 'text-red-500',    badge: 'bg-red-100 text-red-700',       label: 'Dispositiu offline' },
  water_failed:    { Icon: XCircle,       border: 'border-l-red-400',    bg: 'bg-red-50',    icon: 'text-red-500',    badge: 'bg-red-100 text-red-700',       label: 'Error reg' },
  water_completed: { Icon: CheckCircle,   border: 'border-l-green-400',  bg: 'bg-green-50',  icon: 'text-green-500',  badge: 'bg-green-100 text-green-700',   label: 'Reg completat' },
  sensor_error:    { Icon: AlertTriangle, border: 'border-l-orange-400', bg: 'bg-orange-50', icon: 'text-orange-500', badge: 'bg-orange-100 text-orange-700', label: 'Error sensor' },
}

const DEFAULT_STYLE = { Icon: Info, border: 'border-l-blue-400', bg: 'bg-blue-50', icon: 'text-blue-500', badge: 'bg-blue-100 text-blue-700', label: 'Info' }

function timeAgo(isoString) {
  const diff = (Date.now() - new Date(isoString)) / 1000
  if (diff < 60) return 'Ara mateix'
  if (diff < 3600) return `Fa ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Fa ${Math.floor(diff / 3600)} h`
  return `Fa ${Math.floor(diff / 86400)} d`
}

function AlertItem({ alert, onResolve, onDelete }) {
  const s = STYLES[alert.type] ?? DEFAULT_STYLE
  const [acting, setActing] = useState(false)

  async function handleResolve() {
    setActing(true)
    await onResolve(alert.id)
    setActing(false)
  }

  async function handleDelete() {
    setActing(true)
    await onDelete(alert.id)
    setActing(false)
  }

  return (
    <div className={clsx(
      'flex items-start gap-4 rounded-xl border-l-4 p-4',
      s.border, s.bg,
      alert.resolved && 'opacity-50'
    )}>
      <s.Icon className={clsx('w-5 h-5 flex-shrink-0 mt-0.5', s.icon)} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', s.badge)}>
            {s.label}
          </span>
          {alert.zone_id && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600">
              Zona {alert.zone_id}
            </span>
          )}
          {alert.resolved && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Resolt</span>
          )}
          <span className="text-xs text-gray-400 ml-auto">{timeAgo(alert.created_at)}</span>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">{alert.message}</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {!alert.resolved && (
          <button
            onClick={handleResolve}
            disabled={acting}
            title="Marcar com a resolt"
            className="p-1.5 rounded-lg text-gray-400 hover:bg-white/70 hover:text-green-600 transition-colors disabled:opacity-40"
          >
            {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          </button>
        )}
        {alert.resolved && (
          <button
            onClick={handleDelete}
            disabled={acting}
            title="Eliminar"
            className="p-1.5 rounded-lg text-gray-400 hover:bg-white/70 hover:text-red-500 transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

function PushToggle() {
  const [status, setStatus] = useState('idle') // idle | requesting | subscribed | unsupported
  const [subId, setSubId] = useState(null)
  const [loading, setLoading] = useState(false)

  const supported = 'serviceWorker' in navigator && 'PushManager' in window

  useEffect(() => {
    if (!supported) { setStatus('unsupported'); return }
    navigator.serviceWorker.ready.then(async (reg) => {
      const existing = await reg.pushManager.getSubscription()
      setStatus(existing ? 'subscribed' : 'idle')
    })
  }, [supported])

  async function subscribe() {
    setLoading(true)
    try {
      const vapidKey = await getVapidPublicKey()
      const reg = await navigator.serviceWorker.ready
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setLoading(false); return }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      const { id } = await saveSubscription(sub)
      setSubId(id)
      setStatus('subscribed')
    } catch (e) {
      console.error('Push subscribe error', e)
    }
    setLoading(false)
  }

  async function unsubscribe() {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()
      if (subId) await deleteSubscription(subId).catch(() => {})
      setStatus('idle')
      setSubId(null)
    } catch (e) {
      console.error('Push unsubscribe error', e)
    }
    setLoading(false)
  }

  if (status === 'unsupported') {
    return <p className="text-sm text-gray-400">El navegador no suporta notificacions push.</p>
  }

  const isSubscribed = status === 'subscribed'

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-700">Notificacions push</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {isSubscribed ? 'Activades en aquest dispositiu' : 'Rebràs alertes crítiques al mòbil o PC'}
        </p>
      </div>
      <button
        onClick={isSubscribed ? unsubscribe : subscribe}
        disabled={loading}
        className={clsx(
          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] disabled:opacity-50',
          isSubscribed
            ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            : 'bg-green-500 hover:bg-green-600 text-white'
        )}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isSubscribed ? (
          <><BellOff className="w-4 h-4" /> Desactivar</>
        ) : (
          <><Bell className="w-4 h-4" /> Activar</>
        )}
      </button>
    </div>
  )
}

export default function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await fetchAlerts()
      setAlerts(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleResolve = async (id) => {
    await resolveAlert(id)
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, resolved: true, resolved_at: new Date().toISOString() } : a))
  }

  const handleDelete = async (id) => {
    await deleteAlert(id)
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  const active = alerts.filter(a => !a.resolved)
  const resolved = alerts.filter(a => a.resolved)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-green-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Active alerts */}
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Alertes actives</h2>
          {active.length > 0 && (
            <span className="w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
              {active.length}
            </span>
          )}
        </div>
        <div className="p-4 space-y-3">
          {active.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle className="w-8 h-8 text-green-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Cap alerta activa</p>
            </div>
          ) : (
            active.map(a => (
              <AlertItem key={a.id} alert={a} onResolve={handleResolve} onDelete={handleDelete} />
            ))
          )}
        </div>
      </div>

      {/* Resolved alerts */}
      {resolved.length > 0 && (
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-500">Resoltes ({resolved.length})</h2>
          </div>
          <div className="p-4 space-y-3">
            {resolved.map(a => (
              <AlertItem key={a.id} alert={a} onResolve={handleResolve} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}

      {/* Notification settings */}
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Bell className="w-4 h-4 text-gray-400" />
          <h2 className="font-semibold text-gray-900">Configuració de notificacions</h2>
        </div>
        <div className="px-6 py-5">
          <PushToggle />
        </div>
      </div>
    </div>
  )
}
