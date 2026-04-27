import { useState, useEffect, useCallback } from 'react'
import {
  CircuitBoard, Plus, Pencil, Trash2, Loader2, X, Check,
  Zap, Thermometer, Sun, Radio, Droplet, Gauge, Send,
  ChevronDown, ChevronUp, Cpu,
} from 'lucide-react'
import clsx from 'clsx'
import { fetchDevices } from '../api/devices'
import {
  fetchPeripherals, createPeripheral, updatePeripheral, deletePeripheral,
  assignZoneSoil, assignZoneRelay, assignTankPeripheral, pushHardwareConfig,
} from '../api/peripherals'
import { fetchZones } from '../api/zones'
import { fetchTanks } from '../api/tanks'

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_META = {
  SOIL_ADC:     { label: 'Humitat terra',  Icon: Droplet,     bg: 'bg-amber-100',  text: 'text-amber-700',  hasPin1: true,  hasPin2: false, hasI2c: false, hasCal: true  },
  RELAY:        { label: 'Relé',           Icon: Zap,         bg: 'bg-blue-100',   text: 'text-blue-700',   hasPin1: true,  hasPin2: false, hasI2c: false, hasCal: false },
  HTU21D:       { label: 'HTU21D',         Icon: Thermometer, bg: 'bg-cyan-100',   text: 'text-cyan-700',   hasPin1: false, hasPin2: false, hasI2c: true,  hasCal: false },
  BH1750:       { label: 'BH1750',         Icon: Sun,         bg: 'bg-orange-100', text: 'text-orange-700', hasPin1: false, hasPin2: false, hasI2c: true,  hasCal: false },
  HC_SR04:      { label: 'HC-SR04',        Icon: Radio,       bg: 'bg-violet-100', text: 'text-violet-700', hasPin1: true,  hasPin2: true,  hasI2c: false, hasCal: false },
  FLOAT_BINARY: { label: 'Flotador binari', Icon: Gauge,      bg: 'bg-teal-100',   text: 'text-teal-700',   hasPin1: true,  hasPin2: true,  hasI2c: false, hasCal: false },
}

const AGGREGATION_OPTIONS = [
  { value: 'AVG',       label: 'Mitjana' },
  { value: 'ANY_BELOW', label: 'Qualsevol per sota' },
  { value: 'ALL_BELOW', label: 'Tots per sota' },
]

const EMPTY_FORM = {
  name: '', type: 'SOIL_ADC', pin1: '', pin2: '',
  i2c_address: '', i2c_bus: 0, cal_empty: '', cal_full: '', enabled: true,
}

// ─── TypeBadge ───────────────────────────────────────────────────────────────

function TypeBadge({ type, size = 'sm' }) {
  const meta = TYPE_META[type]
  if (!meta) return <span className="text-xs text-gray-400">{type}</span>
  const { Icon, bg, text, label } = meta
  return (
    <span className={clsx('inline-flex items-center gap-1 font-medium rounded-full', bg, text,
      size === 'xs' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
    )}>
      <Icon className={size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {label}
    </span>
  )
}

// ─── PeripheralModal ─────────────────────────────────────────────────────────

function PeripheralModal({ deviceId, peripheral, onClose, onSaved }) {
  const isEdit = !!peripheral
  const [form, setForm] = useState(isEdit ? {
    name:        peripheral.name,
    type:        peripheral.type,
    pin1:        peripheral.pin1 ?? '',
    pin2:        peripheral.pin2 ?? '',
    i2c_address: peripheral.i2c_address ?? '',
    i2c_bus:     peripheral.i2c_bus ?? 0,
    cal_empty:   peripheral.extra_config?.cal_empty ?? '',
    cal_full:    peripheral.extra_config?.cal_full ?? '',
    enabled:     peripheral.enabled,
  } : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  const meta = TYPE_META[form.type] || TYPE_META.SOIL_ADC

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name:    form.name.trim(),
        type:    form.type,
        pin1:    meta.hasPin1 && form.pin1 !== '' ? parseInt(form.pin1)        : null,
        pin2:    meta.hasPin2 && form.pin2 !== '' ? parseInt(form.pin2)        : null,
        i2c_address: meta.hasI2c && form.i2c_address !== '' ? parseInt(form.i2c_address) : null,
        i2c_bus: meta.hasI2c ? parseInt(form.i2c_bus) : 0,
        extra_config: meta.hasCal ? {
          cal_empty: form.cal_empty !== '' ? parseInt(form.cal_empty) : null,
          cal_full:  form.cal_full  !== '' ? parseInt(form.cal_full)  : null,
        } : null,
        enabled: form.enabled,
      }
      if (isEdit) {
        await updatePeripheral(deviceId, peripheral.id, payload)
        onSaved({ ...peripheral, ...payload })
      } else {
        const created = await createPeripheral(deviceId, payload)
        onSaved(created)
      }
    } catch {
      setError('Error desant el perifèric. Comprova els valors.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">
            {isEdit ? 'Editar perifèric' : 'Nou perifèric'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nom</label>
            <input
              required
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Ex: Sensor terra zona 1"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400"
            />
          </div>

          {/* Type (only on create) */}
          {!isEdit && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tipus</label>
              <select
                value={form.type}
                onChange={e => set('type', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 bg-white"
              >
                {Object.entries(TYPE_META).map(([value, { label }]) => (
                  <option key={value} value={value}>{label} ({value})</option>
                ))}
              </select>
            </div>
          )}

          {/* Pin1 */}
          {meta.hasPin1 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {form.type === 'HC_SR04' ? 'GPIO Trigger' : form.type === 'FLOAT_BINARY' ? 'GPIO nivell alt' : 'GPIO'}
              </label>
              <input
                type="number" min={0} max={39}
                value={form.pin1}
                onChange={e => set('pin1', e.target.value)}
                placeholder="0–39"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400"
              />
            </div>
          )}

          {/* Pin2 */}
          {meta.hasPin2 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {form.type === 'HC_SR04' ? 'GPIO Echo' : 'GPIO nivell baix (opcional)'}
              </label>
              <input
                type="number" min={0} max={39}
                value={form.pin2}
                onChange={e => set('pin2', e.target.value)}
                placeholder="0–39"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400"
              />
            </div>
          )}

          {/* I2C */}
          {meta.hasI2c && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Adreça I2C</label>
                <input
                  type="number" min={0} max={127}
                  value={form.i2c_address}
                  onChange={e => set('i2c_address', e.target.value)}
                  placeholder={form.type === 'HTU21D' ? '64 (0x40)' : '35 (0x23)'}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Bus I2C</label>
                <select
                  value={form.i2c_bus}
                  onChange={e => set('i2c_bus', parseInt(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 bg-white"
                >
                  <option value={0}>Bus 0</option>
                  <option value={1}>Bus 1</option>
                </select>
              </div>
            </div>
          )}

          {/* Calibration (SOIL_ADC) */}
          {meta.hasCal && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Cal. sec (ADC)</label>
                <input
                  type="number" min={0} max={4095}
                  value={form.cal_empty}
                  onChange={e => set('cal_empty', e.target.value)}
                  placeholder="Ex: 3800"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Cal. mullat (ADC)</label>
                <input
                  type="number" min={0} max={4095}
                  value={form.cal_full}
                  onChange={e => set('cal_full', e.target.value)}
                  placeholder="Ex: 1200"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400"
                />
              </div>
            </div>
          )}

          {/* Enabled */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => set('enabled', !form.enabled)}
              className={clsx(
                'w-9 h-5 rounded-full transition-colors relative',
                form.enabled ? 'bg-green-500' : 'bg-gray-200'
              )}
            >
              <span className={clsx(
                'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                form.enabled ? 'translate-x-4' : 'translate-x-0.5'
              )} />
            </div>
            <span className="text-sm text-gray-700">Habilitat</span>
          </label>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel·lar
            </button>
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEdit ? 'Desa canvis' : 'Crear perifèric'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── PeripheralCard ───────────────────────────────────────────────────────────

function PeripheralCard({ peripheral, onEdit, onDelete }) {
  const [deleting, setDeleting] = useState(false)
  const meta = TYPE_META[peripheral.type]

  async function handleDelete() {
    if (!confirm(`Eliminar "${peripheral.name}"? Les assignacions a zones i dipòsits es perdran.`)) return
    setDeleting(true)
    try { await onDelete(peripheral.id) } catch { setDeleting(false) }
  }

  return (
    <div className={clsx(
      'rounded-xl border bg-white overflow-hidden transition-opacity',
      !peripheral.enabled && 'opacity-60',
      'border-gray-200 shadow-sm'
    )}>
      <div className="px-4 py-3 flex items-start gap-3">
        {/* Icon */}
        {meta && (
          <div className={clsx('flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center', meta.bg)}>
            <meta.Icon className={clsx('w-4.5 h-4.5', meta.text)} style={{ width: 18, height: 18 }} />
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{peripheral.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <TypeBadge type={peripheral.type} size="xs" />
            {peripheral.pin1 != null && (
              <span className="text-[11px] text-gray-400 font-mono">GPIO{peripheral.pin1}</span>
            )}
            {peripheral.pin2 != null && (
              <span className="text-[11px] text-gray-400 font-mono">GPIO{peripheral.pin2}</span>
            )}
            {peripheral.i2c_address != null && (
              <span className="text-[11px] text-gray-400 font-mono">0x{peripheral.i2c_address.toString(16).padStart(2, '0').toUpperCase()}</span>
            )}
            {peripheral.extra_config?.cal_empty != null && peripheral.extra_config?.cal_full != null && (
              <span className="text-[11px] text-gray-400">Cal: {peripheral.extra_config.cal_empty}–{peripheral.extra_config.cal_full}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onEdit(peripheral)}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ZoneAssignRow ────────────────────────────────────────────────────────────

function ZoneAssignRow({ deviceId, zone, peripherals }) {
  const relays    = peripherals.filter(p => p.type === 'RELAY')
  const soilSensors = peripherals.filter(p => p.type === 'SOIL_ADC')

  const [relayId,     setRelayId]     = useState(zone.relay_peripheral_id ?? '')
  const [soilIds,     setSoilIds]     = useState(zone.soil_peripheral_ids ?? [])
  const [aggMode,     setAggMode]     = useState(zone.soil_aggregation_mode ?? 'AVG')
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [error,       setError]       = useState(null)

  function toggleSoil(id) {
    setSoilIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await Promise.all([
        assignZoneRelay(deviceId, { zone_id: zone.id, peripheral_id: relayId !== '' ? parseInt(relayId) : null }),
        assignZoneSoil(deviceId, { zone_id: zone.id, peripheral_ids: soilIds, aggregation_mode: aggMode }),
      ])
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError('Error desant assignació')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <p className="text-sm font-semibold text-gray-800">{zone.name}</p>

      {/* Relay */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Relé</label>
        <select
          value={relayId}
          onChange={e => setRelayId(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 bg-white"
        >
          <option value="">— Cap —</option>
          {relays.map(r => (
            <option key={r.id} value={r.id}>{r.name} (GPIO{r.pin1})</option>
          ))}
        </select>
      </div>

      {/* Soil sensors */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Sensors d'humitat</label>
        {soilSensors.length === 0 ? (
          <p className="text-xs text-gray-300 italic">Cap sensor SOIL_ADC configurat</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {soilSensors.map(s => (
              <label key={s.id} className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={soilIds.includes(s.id)}
                  onChange={() => toggleSoil(s.id)}
                  className="rounded border-gray-300 text-green-500 focus:ring-green-400"
                />
                <span className="text-xs text-gray-700">{s.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Aggregation mode — only relevant if >=1 soil sensor selected */}
      {soilIds.length > 1 && (
        <div>
          <label className="block text-xs text-gray-400 mb-1">Mode d'agregació</label>
          <div className="flex gap-2 flex-wrap">
            {AGGREGATION_OPTIONS.map(opt => (
              <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="radio"
                  name={`agg-${zone.id}`}
                  value={opt.value}
                  checked={aggMode === opt.value}
                  onChange={() => setAggMode(opt.value)}
                  className="text-green-500 focus:ring-green-400"
                />
                <span className="text-xs text-gray-700">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5 text-green-500" /> : null}
        {saved ? 'Desat!' : 'Desa assignació'}
      </button>
    </div>
  )
}

// ─── TankAssignRow ────────────────────────────────────────────────────────────

function TankAssignRow({ deviceId, tank, peripherals }) {
  const tankSensors = peripherals.filter(p => p.type === 'HC_SR04' || p.type === 'FLOAT_BINARY')
  const [peripheralId, setPeripheralId] = useState(tank.peripheral_id ?? '')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await assignTankPeripheral(deviceId, {
        tank_id: tank.id,
        peripheral_id: peripheralId !== '' ? parseInt(peripheralId) : null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError('Error desant assignació')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <p className="text-sm font-semibold text-gray-800">{tank.name}</p>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Sensor de nivell</label>
        <select
          value={peripheralId}
          onChange={e => setPeripheralId(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 bg-white"
        >
          <option value="">— Cap —</option>
          {tankSensors.map(s => (
            <option key={s.id} value={s.id}>{s.name} ({s.type})</option>
          ))}
        </select>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5 text-green-500" /> : null}
        {saved ? 'Desat!' : 'Desa assignació'}
      </button>
    </div>
  )
}

// ─── CollapsibleSection ───────────────────────────────────────────────────────

function CollapsibleSection({ title, count, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left mb-3 group"
      >
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        {count != null && (
          <span className="text-xs text-gray-400 font-medium">{count}</span>
        )}
        <span className="ml-auto text-gray-400 group-hover:text-gray-600">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>
      {open && children}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Peripherals() {
  const [devices,       setDevices]       = useState([])
  const [selectedId,    setSelectedId]    = useState(null)
  const [peripherals,   setPeripherals]   = useState([])
  const [zones,         setZones]         = useState([])
  const [tanks,         setTanks]         = useState([])
  const [loading,       setLoading]       = useState(true)
  const [modal,         setModal]         = useState(null) // null | 'create' | peripheral object
  const [pushing,       setPushing]       = useState(false)
  const [pushResult,    setPushResult]    = useState(null)
  const [pushError,     setPushError]     = useState(null)

  const loadDevices = useCallback(async () => {
    try {
      const data = await fetchDevices()
      setDevices(data)
      if (data.length > 0 && !selectedId) setSelectedId(data[0].id)
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [selectedId])

  const loadPeripherals = useCallback(async () => {
    if (!selectedId) return
    try {
      const [perifs, zns, tks] = await Promise.all([
        fetchPeripherals(selectedId),
        fetchZones(),
        fetchTanks(),
      ])
      setPeripherals(perifs)
      setZones(zns.filter(z => z.device_id === selectedId))
      setTanks(tks.filter(t => t.device_id === selectedId))
    } catch { /* silent */ }
  }, [selectedId])

  useEffect(() => { loadDevices() }, [loadDevices])
  useEffect(() => { loadPeripherals() }, [loadPeripherals])

  function handleSaved(saved, isEdit) {
    if (isEdit) {
      setPeripherals(prev => prev.map(p => p.id === saved.id ? saved : p))
    } else {
      setPeripherals(prev => [...prev, saved])
    }
    setModal(null)
  }

  async function handleDelete(peripheralId) {
    await deletePeripheral(selectedId, peripheralId)
    setPeripherals(prev => prev.filter(p => p.id !== peripheralId))
  }

  async function handlePush() {
    setPushing(true)
    setPushResult(null)
    setPushError(null)
    try {
      const res = await pushHardwareConfig(selectedId)
      setPushResult(res)
    } catch {
      setPushError('Error enviant la configuració. Comprova que el dispositiu és en línia.')
    } finally {
      setPushing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-green-500" />
      </div>
    )
  }

  if (devices.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
        <Cpu className="w-10 h-10 text-gray-200 mx-auto mb-4" />
        <p className="text-sm font-medium text-gray-400">Cap dispositiu registrat</p>
        <p className="text-xs text-gray-300 mt-1.5 max-w-xs mx-auto">
          L'ESP32 es registrarà automàticament quan es connecti al broker MQTT
        </p>
      </div>
    )
  }

  const deviceZones = zones
  const deviceTanks = tanks

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Device tabs */}
      {devices.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {devices.map(d => (
            <button
              key={d.id}
              onClick={() => setSelectedId(d.id)}
              className={clsx(
                'px-4 py-1.5 rounded-full text-sm font-medium transition-colors border',
                selectedId === d.id
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-green-400 hover:text-green-600'
              )}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}

      {/* Peripherals section */}
      <CollapsibleSection title="Hardware connectat" count={peripherals.length}>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {peripherals.map(p => (
              <PeripheralCard
                key={p.id}
                peripheral={p}
                onEdit={setModal}
                onDelete={handleDelete}
              />
            ))}
          </div>

          {peripherals.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center">
              <CircuitBoard className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Cap perifèric configurat</p>
            </div>
          )}

          <button
            onClick={() => setModal('create')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-green-600 border border-green-200 bg-green-50 hover:bg-green-100 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Afegir perifèric
          </button>
        </div>
      </CollapsibleSection>

      {/* Zone assignments */}
      {deviceZones.length > 0 && (
        <CollapsibleSection title="Assignacions a zones" count={deviceZones.length}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {deviceZones.map(z => (
              <ZoneAssignRow
                key={z.id}
                deviceId={selectedId}
                zone={z}
                peripherals={peripherals}
              />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Tank assignments */}
      {deviceTanks.length > 0 && (
        <CollapsibleSection title="Assignacions a dipòsits" count={deviceTanks.length}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {deviceTanks.map(t => (
              <TankAssignRow
                key={t.id}
                deviceId={selectedId}
                tank={t}
                peripherals={peripherals}
              />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Push config */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-gray-800">Enviar config al dispositiu</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Publica la configuració de perifèrics, zones i dipòsits al dispositiu via MQTT.
              L'ESP32 la desarà i es reiniciarà.
            </p>
          </div>
          <button
            onClick={handlePush}
            disabled={pushing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            {pushing
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />
            }
            {pushing ? 'Enviant...' : 'Enviar config'}
          </button>
        </div>

        {pushResult && (
          <div className="mt-3 text-xs bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2">
            Publicat correctament — {pushResult.peripherals} perifèrics · {pushResult.zones} zones · {pushResult.tanks} dipòsits
          </div>
        )}
        {pushError && (
          <div className="mt-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2">
            {pushError}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal !== null && (
        <PeripheralModal
          deviceId={selectedId}
          peripheral={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
