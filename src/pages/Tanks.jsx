import { useState, useEffect, useCallback } from 'react'
import {
  Droplets, Plus, X, Loader2, CheckCircle, AlertCircle,
  Trash2, Settings, Target,
} from 'lucide-react'
import clsx from 'clsx'
import { fetchTanks, createTank, updateTank, deleteTank, calibrateTank } from '../api/tanks'
import { fetchDevices } from '../api/devices'

const SENSOR_TYPES = [
  { value: 'binary_single',  label: 'Binari simple (1 sensor flotador)' },
  { value: 'binary_dual',    label: 'Binari doble (2 sensors flotadors)' },
  { value: 'ultrasonic',     label: 'Ultrasònic HC-SR04' },
  { value: 'pressure_adc',   label: 'Pressió ADC' },
  { value: 'capacitive_adc', label: 'Capacitiu ADC' },
]

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
    name: tank?.name ?? '',
    device_id: tank?.device_id ?? '',
    sensor_type: tank?.sensor_type ?? 'binary_single',
    gpio_pin_1: tank?.gpio_pin_1 ?? '',
    gpio_pin_2: tank?.gpio_pin_2 ?? '',
    capacity_liters: tank?.capacity_liters ?? '',
    low_threshold_pct: tank?.low_threshold_pct ?? 20,
    empty_threshold_pct: tank?.empty_threshold_pct ?? 5,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const needsCalibration = ['ultrasonic', 'pressure_adc', 'capacitive_adc'].includes(form.sensor_type)
  const hasTwoSensors = form.sensor_type !== 'binary_single' && form.sensor_type !== 'pressure_adc' && form.sensor_type !== 'capacitive_adc'

  async function handleSave() {
    if (!form.name.trim()) { setError('El nom és obligatori'); return }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: form.name.trim(),
        device_id: form.device_id !== '' ? Number(form.device_id) : null,
        sensor_type: form.sensor_type,
        gpio_pin_1: form.gpio_pin_1 !== '' ? Number(form.gpio_pin_1) : null,
        gpio_pin_2: form.gpio_pin_2 !== '' ? Number(form.gpio_pin_2) : null,
        capacity_liters: form.capacity_liters !== '' ? Number(form.capacity_liters) : null,
        low_threshold_pct: Number(form.low_threshold_pct),
        empty_threshold_pct: Number(form.empty_threshold_pct),
      }
      if (isEdit) {
        await updateTank(tank.id, payload)
      } else {
        await createTank(payload)
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
                onChange={e => set('device_id', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              >
                <option value="">Sense dispositiu</option>
                {devices.map(d => (
                  <option key={d.id} value={d.id}>{d.name}{d.online ? ' ●' : ' ○'}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipus de sensor</label>
              <select
                value={form.sensor_type}
                onChange={e => set('sensor_type', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              >
                {SENSOR_TYPES.map(st => (
                  <option key={st.value} value={st.value}>{st.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {form.sensor_type === 'ultrasonic' ? 'GPIO Trigger (pin1)' : 'GPIO Pin 1'}
                </label>
                <input
                  type="number" min={0} max={39}
                  value={form.gpio_pin_1}
                  onChange={e => set('gpio_pin_1', e.target.value)}
                  placeholder="—"
                  className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm text-center focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              {(hasTwoSensors || form.sensor_type === 'binary_dual' || form.sensor_type === 'ultrasonic') && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {form.sensor_type === 'ultrasonic' ? 'GPIO Echo (pin2)' : 'GPIO Pin 2'}
                  </label>
                  <input
                    type="number" min={0} max={39}
                    value={form.gpio_pin_2}
                    onChange={e => set('gpio_pin_2', e.target.value)}
                    placeholder="—"
                    className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm text-center focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
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

            {needsCalibration && isEdit && (
              <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5 text-xs text-blue-700">
                Calibra el sensor des de la targeta del dipòsit un cop desat.
              </div>
            )}

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
  const [calibrating, setCalibrating] = useState(null) // 'empty' | 'full'
  const [calStatus, setCalStatus] = useState(null)

  const status = tank.status
  const needsCalibration = ['ultrasonic', 'pressure_adc', 'capacitive_adc'].includes(tank.sensor_type)
  const sensorLabel = SENSOR_TYPES.find(s => s.value === tank.sensor_type)?.label ?? tank.sensor_type
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

  async function handleCalibrate(level) {
    setCalibrating(level)
    setCalStatus(null)
    try {
      const r = await calibrateTank(tank.id, level)
      setCalStatus({ ok: true, msg: `Calibrat: ${level === 'empty' ? 'buit' : 'ple'} = ${r.calibration_value}` })
      onSaved()
    } catch (e) {
      setCalStatus({ ok: false, msg: e.response?.data?.detail ?? 'Error de calibratge' })
    } finally {
      setCalibrating(null)
      setTimeout(() => setCalStatus(null), 4000)
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
              <p className="text-xs text-gray-400 truncate">{sensorLabel}{deviceName ? ` · ${deviceName}` : ''}</p>
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

        {/* Calibration */}
        {needsCalibration && (
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <Target className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Calibratge</span>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => handleCalibrate('empty')}
                disabled={calibrating !== null}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                {calibrating === 'empty' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Marcar buit ara
              </button>
              <button
                onClick={() => handleCalibrate('full')}
                disabled={calibrating !== null}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-blue-200 text-xs text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
              >
                {calibrating === 'full' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Marcar ple ara
              </button>
            </div>
            {calStatus && (
              <div className={clsx(
                'flex items-center gap-2 text-xs mt-2 px-2 py-1.5 rounded-lg',
                calStatus.ok ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'
              )}>
                {calStatus.ok ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                {calStatus.msg}
              </div>
            )}
          </div>
        )}
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
