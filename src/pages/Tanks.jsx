import { useState, useEffect, useCallback } from 'react'
import {
  Droplets, Plus, X, Loader2, AlertCircle,
  Trash2, Settings,
} from 'lucide-react'
import clsx from 'clsx'
import { fetchTanks, createTank, updateTank, deleteTank } from '../api/tanks'
import { fetchDevices } from '../api/devices'
import { fetchPeripherals, assignTankPeripheral } from '../api/peripherals'

const STATE_CONFIG = {
  full:    { label: 'Ple',  bg: 'bg-blue-100',   text: 'text-blue-700',   bar: 'bg-blue-400' },
  ok:      { label: 'Bé',   bg: 'bg-green-100',  text: 'text-green-700',  bar: 'bg-green-400' },
  low:     { label: 'Baix', bg: 'bg-orange-100', text: 'text-orange-700', bar: 'bg-orange-400' },
  empty:   { label: 'Buit', bg: 'bg-red-100',    text: 'text-red-700',    bar: 'bg-red-400' },
  unknown: { label: '—',    bg: 'bg-gray-100',   text: 'text-gray-500',   bar: 'bg-gray-300' },
}

function TankLevelBar({ status }) {
  const pct = status?.level_percent
  const state = status?.sensor_state ?? 'unknown'
  const cfg = STATE_CONFIG[state] ?? STATE_CONFIG.unknown

  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-gray-500 mb-1.5">
        <span>Nivell</span>
        <div className="flex items-center gap-2">
          <span className={clsx('text-xs font-medium px-1.5 py-0.5 rounded-full', cfg.bg, cfg.text)}>
            {cfg.label}
          </span>
          <span className="font-medium">{pct != null ? `${pct.toFixed(0)}%` : '—'}</span>
        </div>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-700', cfg.bar)}
          style={{ width: pct != null ? `${Math.min(pct, 100)}%` : '0%' }}
        />
      </div>
    </div>
  )
}

function TankModal({ tank, devices, onClose, onSaved }) {
  const isEdit = !!tank
  const [form, setForm] = useState({
    name:                tank?.name ?? '',
    device_id:           tank?.device_id ?? '',
    peripheral_id:       tank?.peripheral_id ?? '',
    capacity_liters:     tank?.capacity_liters ?? '',
    low_threshold_pct:   tank?.low_threshold_pct ?? 20,
    empty_threshold_pct: tank?.empty_threshold_pct ?? 5,
  })
  const [peripherals, setPeripherals] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!form.device_id) { setPeripherals([]); return }
    fetchPeripherals(Number(form.device_id))
      .then(data => setPeripherals(data.filter(p => p.type === 'HC_SR04' || p.type === 'FLOAT_BINARY')))
      .catch(() => setPeripherals([]))
  }, [form.device_id])

  async function handleSave() {
    if (!form.name.trim()) { setError('El nom és obligatori'); return }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name:                form.name.trim(),
        device_id:           form.device_id !== '' ? Number(form.device_id) : null,
        capacity_liters:     form.capacity_liters !== '' ? Number(form.capacity_liters) : null,
        low_threshold_pct:   Number(form.low_threshold_pct),
        empty_threshold_pct: Number(form.empty_threshold_pct),
      }
      let tankId
      if (isEdit) {
        await updateTank(tank.id, payload)
        tankId = tank.id
      } else {
        const created = await createTank(payload)
        tankId = created.id
      }
      if (form.device_id !== '') {
        const peripheralId = form.peripheral_id !== '' ? Number(form.peripheral_id) : null
        await assignTankPeripheral(Number(form.device_id), { tank_id: tankId, peripheral_id: peripheralId })
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(e.response?.data?.detail ?? 'Error en desar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md my-4">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">{isEdit ? 'Editar dipòsit' : 'Nou dipòsit'}</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom</label>
              <input
                type="text"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Ex: Dipòsit principal"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ESP32 assignat</label>
              <select
                value={form.device_id}
                onChange={e => { set('device_id', e.target.value); set('peripheral_id', '') }}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              >
                <option value="">Sense dispositiu</option>
                {devices.map(d => (
                  <option key={d.id} value={d.id}>{d.name}{d.online ? ' ●' : ' ○'}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Sensor de nivell</label>
              <select
                value={form.peripheral_id}
                onChange={e => set('peripheral_id', e.target.value)}
                disabled={!form.device_id}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Sense sensor assignat</option>
                {peripherals.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                ))}
              </select>
              {form.device_id && peripherals.length === 0 && (
                <p className="text-[11px] text-gray-400 mt-1">
                  Cap perifèric HC-SR04 ni FLOAT_BINARY al dispositiu seleccionat.
                  Configura'l primer a la pàgina de Dispositius.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Capacitat (litres, opcional)</label>
              <input
                type="number" min={0}
                value={form.capacity_liters}
                onChange={e => set('capacity_liters', e.target.value)}
                placeholder="—"
                className="w-32 px-2 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Llindar baix (%)</label>
                <input
                  type="number" min={0} max={100}
                  value={form.low_threshold_pct}
                  onChange={e => set('low_threshold_pct', e.target.value)}
                  className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm text-center focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Llindar buit (%)</label>
                <input
                  type="number" min={0} max={100}
                  value={form.empty_threshold_pct}
                  onChange={e => set('empty_threshold_pct', e.target.value)}
                  className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm text-center focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel·lar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors min-w-[100px] justify-center"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Desar' : 'Crear dipòsit'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function TankCard({ tank, devices, onSaved, onDeleted }) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const status = tank.status
  const deviceName = devices.find(d => d.id === tank.device_id)?.name

  async function handleDelete() {
    if (!confirm(`Eliminar el dipòsit "${tank.name}"? S'esborraran totes les lectures.`)) return
    setDeleting(true)
    try {
      await deleteTank(tank.id)
      onDeleted()
    } catch {
      setDeleting(false)
      alert('Error en eliminar el dipòsit')
    }
  }

  return (
    <>
      {editing && (
        <TankModal
          tank={tank}
          devices={devices}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); onSaved() }}
        />
      )}

      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Droplets className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">{tank.name}</p>
              <p className="text-xs text-gray-400 truncate">
                {tank.peripheral_id ? `Sensor #${tank.peripheral_id}` : 'Sense sensor'}
                {deviceName ? ` · ${deviceName}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setEditing(true)}
              className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              title="Editar"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              title="Eliminar"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Status */}
        <div className="px-5 py-4">
          <TankLevelBar status={status} />

          {status?.last_reading_at && (
            <p className="text-xs text-gray-400 mt-2">
              Última lectura: {new Date(status.last_reading_at).toLocaleString('ca')}
            </p>
          )}

          {tank.capacity_liters && status?.level_percent != null && (
            <p className="text-xs text-gray-500 mt-1">
              ≈ {(tank.capacity_liters * status.level_percent / 100).toFixed(0)} L / {tank.capacity_liters} L
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-gray-500">
            <div>Llindar baix: <span className="font-medium text-gray-700">{tank.low_threshold_pct}%</span></div>
            <div>Llindar buit: <span className="font-medium text-gray-700">{tank.empty_threshold_pct}%</span></div>
          </div>
        </div>

      </div>
    </>
  )
}

export default function Tanks() {
  const [tanks, setTanks] = useState([])
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    try {
      const [t, d] = await Promise.all([fetchTanks(), fetchDevices()])
      setTanks(t)
      setDevices(d)
      setError(null)
    } catch {
      setError("No s'ha pogut carregar els dipòsits")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-green-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Dipòsits d'aigua</h2>
            <p className="text-sm text-gray-500 mt-0.5">{tanks.length} dipòsit{tanks.length !== 1 ? 's' : ''} configurat{tanks.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nou dipòsit</span>
            <span className="sm:hidden">Nou</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {tanks.map(tank => (
            <TankCard
              key={tank.id}
              tank={tank}
              devices={devices}
              onSaved={load}
              onDeleted={load}
            />
          ))}
        </div>

        {tanks.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
            <Droplets className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-400">Cap dipòsit configurat</p>
            <p className="text-xs text-gray-300 mt-1">Crea un dipòsit per monitorar el nivell d'aigua</p>
          </div>
        )}
      </div>

      {showCreate && (
        <TankModal
          tank={null}
          devices={devices}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load() }}
        />
      )}
    </>
  )
}
