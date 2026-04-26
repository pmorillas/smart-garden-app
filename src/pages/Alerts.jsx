import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, XCircle, Info, CheckCircle, Bell, BellOff, Loader2, Trash2, Settings, Droplets, Wifi, WifiOff, Plus } from 'lucide-react'
import clsx from 'clsx'
import { fetchAlerts, resolveAlert, deleteAlert } from '../api/alerts'
import { fetchAlertRules, createAlertRule, updateAlertRule, deleteAlertRule } from '../api/alert_rules'
import { fetchZones } from '../api/zones'
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

// ── Alert rules ──────────────────────────────────────────────────────────────

const RULE_TYPE_CONFIG = {
  humidity_low:    { label: 'Humitat terra baixa', Icon: Droplets,    color: 'yellow', hasThreshold: true,  thresholdUnit: '%',   thresholdDesc: 'Alertar si humitat <' },
  device_offline:  { label: 'Dispositiu offline',  Icon: WifiOff,     color: 'red',    hasThreshold: true,  thresholdUnit: 'min', thresholdDesc: 'Alertar si offline >' },
  water_completed: { label: 'Reg completat',        Icon: CheckCircle, color: 'green',  hasThreshold: false },
  water_failed:    { label: 'Error de reg',         Icon: XCircle,     color: 'red',    hasThreshold: false },
  sensor_error:    { label: 'Error de sensor',      Icon: AlertTriangle, color: 'orange', hasThreshold: false },
}

const COLOR_CLASSES = {
  yellow: { badge: 'bg-yellow-100 text-yellow-700', icon: 'text-yellow-500' },
  red:    { badge: 'bg-red-100 text-red-700',       icon: 'text-red-500' },
  green:  { badge: 'bg-green-100 text-green-700',   icon: 'text-green-500' },
  orange: { badge: 'bg-orange-100 text-orange-700', icon: 'text-orange-500' },
}

function AlertRuleCard({ rule, zones, onUpdated, onDeleted }) {
  const cfg = RULE_TYPE_CONFIG[rule.alert_type] ?? { label: rule.alert_type, Icon: Info, color: 'blue', hasThreshold: false }
  const colors = COLOR_CLASSES[cfg.color] ?? COLOR_CLASSES.red
  const zoneName = rule.zone_id ? zones.find(z => z.id === rule.zone_id)?.name ?? `Zona ${rule.zone_id}` : null

  const [threshold, setThreshold] = useState(rule.threshold ?? '')
  const [cooldown, setCooldown] = useState(rule.cooldown_minutes)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const handleToggle = async () => {
    await updateAlertRule(rule.id, { enabled: !rule.enabled })
    onUpdated({ ...rule, enabled: !rule.enabled })
  }

  const handleSave = async () => {
    setSaving(true)
    await updateAlertRule(rule.id, {
      threshold: threshold === '' ? null : Number(threshold),
      cooldown_minutes: Number(cooldown),
    })
    onUpdated({ ...rule, threshold: threshold === '' ? null : Number(threshold), cooldown_minutes: Number(cooldown) })
    setDirty(false)
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!window.confirm(`Eliminar la regla "${rule.name}"?`)) return
    await deleteAlertRule(rule.id)
    onDeleted(rule.id)
  }

  return (
    <div className={clsx(
      'rounded-xl border border-gray-200 p-4 space-y-3 transition-opacity',
      !rule.enabled && 'opacity-60'
    )}>
      <div className="flex items-center gap-3">
        <span className={clsx('p-1.5 rounded-lg bg-gray-100', colors.icon)}>
          <cfg.Icon className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800">{rule.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={clsx('text-xs px-1.5 py-0.5 rounded-full font-medium', colors.badge)}>{cfg.label}</span>
            {zoneName && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{zoneName}</span>
            )}
          </div>
        </div>
        {/* Enabled toggle */}
        <button
          onClick={handleToggle}
          className={clsx(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0',
            rule.enabled ? 'bg-green-500' : 'bg-gray-300'
          )}
        >
          <span className={clsx(
            'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
            rule.enabled ? 'translate-x-6' : 'translate-x-1'
          )} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {cfg.hasThreshold && (
          <label className="space-y-1">
            <span className="text-xs text-gray-500">{cfg.thresholdDesc}</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                value={threshold}
                onChange={e => { setThreshold(e.target.value); setDirty(true) }}
                className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
              <span className="text-xs text-gray-400 flex-shrink-0">{cfg.thresholdUnit}</span>
            </div>
          </label>
        )}
        <label className={clsx('space-y-1', !cfg.hasThreshold && 'col-span-2')}>
          <span className="text-xs text-gray-500">Cooldown entre alertes</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              value={cooldown}
              onChange={e => { setCooldown(e.target.value); setDirty(true) }}
              className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
            <span className="text-xs text-gray-400 flex-shrink-0">min</span>
          </div>
        </label>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={handleDelete}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
        >
          <Trash2 className="w-3 h-3" /> Eliminar
        </button>
        {dirty && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Desar
          </button>
        )}
      </div>
    </div>
  )
}

function NewRuleForm({ zones, onSaved, onCancel }) {
  const [form, setForm] = useState({
    name: '', alert_type: 'humidity_low', enabled: true,
    zone_id: '', threshold: '', cooldown_minutes: 60,
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const cfg = RULE_TYPE_CONFIG[form.alert_type] ?? {}

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      alert_type: form.alert_type,
      enabled: form.enabled,
      zone_id: form.zone_id ? Number(form.zone_id) : null,
      threshold: form.threshold !== '' ? Number(form.threshold) : null,
      cooldown_minutes: Number(form.cooldown_minutes),
    }
    const created = await createAlertRule(payload)
    onSaved(created)
    setSaving(false)
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-green-300 p-4 space-y-3 bg-green-50">
      <p className="text-sm font-medium text-green-700">Nova regla d'alerta</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 space-y-1">
          <span className="text-xs text-gray-500">Nom</span>
          <input
            type="text"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Ex. Humitat baixa zona 1"
            className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-gray-500">Tipus</span>
          <select
            value={form.alert_type}
            onChange={e => set('alert_type', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
          >
            {Object.entries(RULE_TYPE_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-gray-500">Zona (opcional)</span>
          <select
            value={form.zone_id}
            onChange={e => set('zone_id', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
          >
            <option value="">Totes les zones</option>
            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </label>
        {cfg.hasThreshold && (
          <label className="space-y-1">
            <span className="text-xs text-gray-500">{cfg.thresholdDesc} ({cfg.thresholdUnit})</span>
            <input
              type="number"
              min="0"
              value={form.threshold}
              onChange={e => set('threshold', e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
          </label>
        )}
        <label className={clsx('space-y-1', !cfg.hasThreshold && 'col-span-2')}>
          <span className="text-xs text-gray-500">Cooldown (min)</span>
          <input
            type="number"
            min="0"
            value={form.cooldown_minutes}
            onChange={e => set('cooldown_minutes', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
          />
        </label>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg transition-colors">
          Cancel·lar
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !form.name.trim()}
          className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          {saving && <Loader2 className="w-3 h-3 animate-spin" />}
          Crear regla
        </button>
      </div>
    </div>
  )
}

function AlertRulesSection() {
  const [rules, setRules] = useState([])
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNewForm, setShowNewForm] = useState(false)

  useEffect(() => {
    Promise.all([fetchAlertRules(), fetchZones()])
      .then(([r, z]) => { setRules(r); setZones(z) })
      .finally(() => setLoading(false))
  }, [])

  const handleUpdated = (updated) => setRules(prev => prev.map(r => r.id === updated.id ? updated : r))
  const handleDeleted = (id) => setRules(prev => prev.filter(r => r.id !== id))
  const handleCreated = (rule) => { setRules(prev => [...prev, rule]); setShowNewForm(false) }

  return (
    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-gray-400" />
          <h2 className="font-semibold text-gray-900">Regles d'alerta</h2>
        </div>
        <button
          onClick={() => setShowNewForm(v => !v)}
          className="flex items-center gap-1.5 text-sm text-green-600 hover:text-green-700 font-medium"
        >
          <Plus className="w-4 h-4" />
          Nova regla
        </button>
      </div>
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-green-500" />
          </div>
        ) : (
          <>
            {showNewForm && (
              <NewRuleForm zones={zones} onSaved={handleCreated} onCancel={() => setShowNewForm(false)} />
            )}
            {rules.map(r => (
              <AlertRuleCard
                key={r.id}
                rule={r}
                zones={zones}
                onUpdated={handleUpdated}
                onDeleted={handleDeleted}
              />
            ))}
            {rules.length === 0 && !showNewForm && (
              <p className="text-sm text-gray-400 text-center py-4">Cap regla configurada</p>
            )}
          </>
        )}
      </div>
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

      {/* Alert rules */}
      <AlertRulesSection />

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
