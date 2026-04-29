import { useState, useEffect, useCallback } from 'react'
import {
  Cpu, Wifi, WifiOff, Pencil, Trash2, Check, X, Loader2, Layers, Timer,
  CircuitBoard, Plus, Zap, Droplet, Thermometer, Sun, Radio, Gauge, Send,
  Settings2, Activity,
} from 'lucide-react'
import clsx from 'clsx'
import { fetchDevices, updateDevice, deleteDevice } from '../api/devices'
import {
  fetchPeripherals, createPeripheral, updatePeripheral, deletePeripheral,
  pushHardwareConfig, readPeripheralLive,
} from '../api/peripherals'

// ─── Peripheral type metadata ─────────────────────────────────────────────────

const TYPE_META = {
  SOIL_ADC:     { label: 'Humitat terra',   Icon: Droplet,     bg: 'bg-amber-100',  text: 'text-amber-700',  hasPin1: true,  hasPin2: false, hasI2c: false, hasCal: true  },
  RELAY:        { label: 'Relé',            Icon: Zap,         bg: 'bg-blue-100',   text: 'text-blue-700',   hasPin1: true,  hasPin2: false, hasI2c: false, hasCal: false },
  HTU21D:       { label: 'HTU21D',          Icon: Thermometer, bg: 'bg-cyan-100',   text: 'text-cyan-700',   hasPin1: false, hasPin2: false, hasI2c: true,  hasCal: false },
  BH1750:       { label: 'BH1750',          Icon: Sun,         bg: 'bg-orange-100', text: 'text-orange-700', hasPin1: false, hasPin2: false, hasI2c: true,  hasCal: false },
  HC_SR04:      { label: 'HC-SR04',         Icon: Radio,       bg: 'bg-violet-100', text: 'text-violet-700', hasPin1: true,  hasPin2: true,  hasI2c: false, hasCal: false },
  FLOAT_BINARY: { label: 'Flotador binari', Icon: Gauge,       bg: 'bg-teal-100',   text: 'text-teal-700',   hasPin1: false, hasPin2: false, hasI2c: false, hasCal: false },
}

const EMPTY_FORM = {
  name: '', type: 'SOIL_ADC', pin1: '', pin2: '',
  i2c_address: '', i2c_bus: 0, cal_empty: '', cal_full: '', enabled: true,
  floatPins: [],
}

const POLL_OPTIONS = [
  { label: '30 s', value: 30 },
  { label: '1 min', value: 60 },
  { label: '2 min', value: 120 },
  { label: '5 min', value: 300 },
  { label: '10 min', value: 600 },
  { label: '15 min', value: 900 },
  { label: '30 min', value: 1800 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(isoString) {
  if (!isoString) return null
  const diff = Math.round((Date.now() - new Date(isoString)) / 1000)
  if (diff < 60)    return `Fa ${diff} s`
  if (diff < 3600)  return `Fa ${Math.round(diff / 60)} min`
  if (diff < 86400) return `Fa ${Math.round(diff / 3600)} h`
  return `Fa ${Math.round(diff / 86400)} d`
}

function TypeBadge({ type }) {
  const meta = TYPE_META[type]
  if (!meta) return <span className="text-[11px] text-gray-400">{type}</span>
  const { Icon, bg, text, label } = meta
  return (
    <span className={clsx('inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5', bg, text)}>
      <Icon style={{ width: 11, height: 11 }} />
      {label}
    </span>
  )
}

// ─── PeripheralFormModal ──────────────────────────────────────────────────────

function PeripheralFormModal({ deviceId, peripheral, onClose, onSaved }) {
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
    floatPins:   peripheral.type === 'FLOAT_BINARY'
      ? (peripheral.extra_config?.pins ?? []).map(p => ({
          pin:       String(p.pin ?? ''),
          level_pct: String(p.level_pct ?? ''),
          mode:      p.mode ?? 'pullup',
        }))
      : [],
  } : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  const meta = TYPE_META[form.type] || TYPE_META.SOIL_ADC
  const set  = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name:        form.name.trim(),
        type:        form.type,
        pin1:        meta.hasPin1 && form.pin1 !== ''        ? parseInt(form.pin1)        : null,
        pin2:        meta.hasPin2 && form.pin2 !== ''        ? parseInt(form.pin2)        : null,
        i2c_address: meta.hasI2c  && form.i2c_address !== '' ? parseInt(form.i2c_address) : null,
        i2c_bus:     meta.hasI2c  ? parseInt(form.i2c_bus) : 0,
        extra_config: form.type === 'FLOAT_BINARY'
          ? { pins: form.floatPins.map(fp => ({
              pin:       fp.pin !== '' ? parseInt(fp.pin) : 0,
              level_pct: fp.level_pct !== '' ? parseInt(fp.level_pct) : 0,
              mode:      fp.mode,
            })) }
          : meta.hasCal ? {
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{isEdit ? 'Editar perifèric' : 'Nou perifèric'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nom</label>
            <input required value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="Ex: Sensor terra zona 1"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400" />
          </div>

          {!isEdit && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tipus</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 bg-white">
                {Object.entries(TYPE_META).map(([value, { label }]) => (
                  <option key={value} value={value}>{label} ({value})</option>
                ))}
              </select>
            </div>
          )}

          {meta.hasPin1 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {form.type === 'HC_SR04' ? 'GPIO Trigger' : form.type === 'FLOAT_BINARY' ? 'GPIO nivell alt' : 'GPIO'}
              </label>
              <input type="number" min={0} max={39} value={form.pin1} onChange={e => set('pin1', e.target.value)}
                placeholder="0–39"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400" />
            </div>
          )}

          {meta.hasPin2 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {form.type === 'HC_SR04' ? 'GPIO Echo' : 'GPIO nivell baix (opcional)'}
              </label>
              <input type="number" min={0} max={39} value={form.pin2} onChange={e => set('pin2', e.target.value)}
                placeholder="0–39"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400" />
            </div>
          )}

          {meta.hasI2c && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Adreça I2C</label>
                <input type="number" min={0} max={127} value={form.i2c_address} onChange={e => set('i2c_address', e.target.value)}
                  placeholder={form.type === 'HTU21D' ? '64 (0x40)' : '35 (0x23)'}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Bus I2C</label>
                <select value={form.i2c_bus} onChange={e => set('i2c_bus', parseInt(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 bg-white">
                  <option value={0}>Bus 0</option>
                  <option value={1}>Bus 1</option>
                </select>
              </div>
            </div>
          )}

          {form.type === 'FLOAT_BINARY' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium text-gray-500">Pins flotadors (fins a 4)</label>
                <button type="button"
                  onClick={() => form.floatPins.length < 4 && set('floatPins', [...form.floatPins, { pin: '', level_pct: '', mode: 'pullup' }])}
                  disabled={form.floatPins.length >= 4}
                  className="flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-700 disabled:opacity-40 disabled:cursor-not-allowed">
                  <Plus className="w-3 h-3" /> Afegir pin
                </button>
              </div>
              {form.floatPins.length === 0 && (
                <p className="text-xs text-gray-400 italic py-1">Cap pin configurat. Afegeix fins a 4 pins.</p>
              )}
              <div className="space-y-2">
                {form.floatPins.map((fp, i) => (
                  <div key={i} className="flex items-end gap-2 rounded-lg border border-gray-200 px-3 py-2.5 bg-gray-50">
                    <div className="w-16">
                      <label className="block text-[10px] text-gray-400 mb-1">GPIO</label>
                      <input type="number" min={0} max={39}
                        value={fp.pin}
                        onChange={e => {
                          const pins = [...form.floatPins]
                          pins[i] = { ...pins[i], pin: e.target.value }
                          set('floatPins', pins)
                        }}
                        placeholder="0–39"
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 bg-white text-center"
                      />
                    </div>
                    <div className="w-20">
                      <label className="block text-[10px] text-gray-400 mb-1">Nivell %</label>
                      <input type="number" min={0} max={100}
                        value={fp.level_pct}
                        onChange={e => {
                          const pins = [...form.floatPins]
                          pins[i] = { ...pins[i], level_pct: e.target.value }
                          set('floatPins', pins)
                        }}
                        placeholder="0–100"
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 bg-white text-center"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] text-gray-400 mb-1">Mode</label>
                      <select
                        value={fp.mode}
                        onChange={e => {
                          const pins = [...form.floatPins]
                          pins[i] = { ...pins[i], mode: e.target.value }
                          set('floatPins', pins)
                        }}
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 bg-white"
                      >
                        <option value="pullup">Pull-up (GND)</option>
                        <option value="pulldown">Pull-down (3.3V)</option>
                      </select>
                    </div>
                    <button type="button"
                      onClick={() => set('floatPins', form.floatPins.filter((_, j) => j !== i))}
                      className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {meta.hasCal && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Cal. sec (ADC)</label>
                <input type="number" min={0} max={4095} value={form.cal_empty} onChange={e => set('cal_empty', e.target.value)}
                  placeholder="Ex: 3800"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Cal. mullat (ADC)</label>
                <input type="number" min={0} max={4095} value={form.cal_full} onChange={e => set('cal_full', e.target.value)}
                  placeholder="Ex: 1200"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400" />
              </div>
            </div>
          )}

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div onClick={() => set('enabled', !form.enabled)}
              className={clsx('w-9 h-5 rounded-full transition-colors relative cursor-pointer', form.enabled ? 'bg-green-500' : 'bg-gray-200')}>
              <span className={clsx('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform', form.enabled ? 'translate-x-4' : 'translate-x-0.5')} />
            </div>
            <span className="text-sm text-gray-700">Habilitat</span>
          </label>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
              Cancel·lar
            </button>
            <button type="submit" disabled={saving || !form.name.trim()}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEdit ? 'Desa canvis' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── LiveReadPanel ────────────────────────────────────────────────────────────

function LiveReadPanel({ deviceId, peripheral, onApplyCal }) {
  const [reading, setReading]   = useState(null)  // {raw_value, calibrated_pct, cal_empty, cal_full}
  const [loading, setLoading]   = useState(false)
  const [error,   setError]     = useState(null)

  async function handleRead() {
    setLoading(true)
    setError(null)
    setReading(null)
    try {
      const data = await readPeripheralLive(deviceId, peripheral.id)
      setReading(data)
    } catch {
      setError('No s\'ha pogut llegir el sensor. Comprova que el dispositiu és en línia.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-amber-800">Lectura en viu (calibratge)</span>
        <button
          onClick={handleRead}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-amber-700 border border-amber-200 bg-white hover:bg-amber-50 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
          {loading ? 'Llegint...' : 'Llegir ara'}
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {reading && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-amber-700 font-mono font-semibold">RAW: {reading.raw_value}</span>
            {reading.calibrated_pct != null && (
              <span className="text-gray-500">→ {reading.calibrated_pct}% humitat</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onApplyCal('cal_empty', reading.raw_value)}
              className="flex-1 px-2 py-1 rounded text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:border-amber-300 hover:text-amber-700 transition-colors"
              title={`Marcar ${reading.raw_value} com a valor SEC (0%)`}
            >
              → Sec (0%)
            </button>
            <button
              onClick={() => onApplyCal('cal_full', reading.raw_value)}
              className="flex-1 px-2 py-1 rounded text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:border-blue-300 hover:text-blue-700 transition-colors"
              title={`Marcar ${reading.raw_value} com a valor MULLAT (100%)`}
            >
              → Mullat (100%)
            </button>
          </div>
          <p className="text-[10px] text-amber-600">
            Cal. actual: Sec={reading.cal_empty} · Mullat={reading.cal_full}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── HardwareConfigModal ──────────────────────────────────────────────────────

function HardwareConfigModal({ device, onClose }) {
  const [peripherals,  setPeripherals]  = useState([])
  const [loading,      setLoading]      = useState(true)
  const [formModal,    setFormModal]    = useState(null) // null | 'create' | peripheral
  const [liveReadId,   setLiveReadId]   = useState(null) // peripheral id with open read panel
  const [pushing,      setPushing]      = useState(false)
  const [pushResult,   setPushResult]   = useState(null)
  const [pushError,    setPushError]    = useState(null)

  const load = useCallback(async () => {
    try {
      const data = await fetchPeripherals(device.id)
      setPeripherals(data)
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [device.id])

  useEffect(() => { load() }, [load])

  function handleSaved(saved, isEdit) {
    if (isEdit !== false) {
      // edit: check if it was an edit by looking if id exists in list
      const exists = peripherals.some(p => p.id === saved.id)
      if (exists) {
        setPeripherals(prev => prev.map(p => p.id === saved.id ? saved : p))
      } else {
        setPeripherals(prev => [...prev, saved])
      }
    }
    setFormModal(null)
  }

  async function handleDelete(id) {
    if (!confirm('Eliminar aquest perifèric? Les assignacions a zones i dipòsits es perdran.')) return
    await deletePeripheral(device.id, id)
    setPeripherals(prev => prev.filter(p => p.id !== id))
  }

  async function handlePush() {
    setPushing(true)
    setPushResult(null)
    setPushError(null)
    try {
      const res = await pushHardwareConfig(device.id)
      setPushResult(res)
    } catch {
      setPushError('Error enviant la configuració. Comprova que el dispositiu és en línia.')
    } finally {
      setPushing(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl my-8">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Configuració hardware</h2>
              <p className="text-xs text-gray-400 mt-0.5">{device.name}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Peripherals list */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-700">Perifèrics</p>
                <button onClick={() => setFormModal('create')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-green-600 border border-green-200 bg-green-50 hover:bg-green-100 transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                  Afegir
                </button>
              </div>

              {loading ? (
                <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-green-500" /></div>
              ) : peripherals.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center">
                  <CircuitBoard className="w-7 h-7 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Cap perifèric configurat</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {peripherals.map(p => {
                    const meta = TYPE_META[p.type]
                    const showLiveRead = liveReadId === p.id
                    return (
                      <div key={p.id} className={clsx(
                        'rounded-xl border border-gray-200 px-4 py-3',
                        !p.enabled && 'opacity-50'
                      )}>
                        <div className="flex items-center gap-3">
                          {meta && (
                            <div className={clsx('flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center', meta.bg)}>
                              <meta.Icon style={{ width: 16, height: 16 }} className={meta.text} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              <TypeBadge type={p.type} />
                              {p.type !== 'FLOAT_BINARY' && p.pin1 != null && <span className="text-[11px] text-gray-400 font-mono">GPIO{p.pin1}</span>}
                              {p.type !== 'FLOAT_BINARY' && p.pin2 != null && <span className="text-[11px] text-gray-400 font-mono">GPIO{p.pin2}</span>}
                              {p.type === 'FLOAT_BINARY' && p.extra_config?.pins?.length > 0 && (
                                <span className="text-[11px] text-gray-400 font-mono">
                                  {p.extra_config.pins.map(pin => `GPIO${pin.pin}`).join(', ')} · {p.extra_config.pins.length} pin{p.extra_config.pins.length !== 1 ? 's' : ''}
                                </span>
                              )}
                              {p.i2c_address != null && <span className="text-[11px] text-gray-400 font-mono">0x{p.i2c_address.toString(16).padStart(2, '0').toUpperCase()}</span>}
                              {p.extra_config?.cal_empty != null && <span className="text-[11px] text-gray-400">Cal: {p.extra_config.cal_empty}–{p.extra_config.cal_full}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {p.type === 'SOIL_ADC' && (
                              <button
                                onClick={() => setLiveReadId(showLiveRead ? null : p.id)}
                                title="Llegir valor actual (calibratge)"
                                className={clsx(
                                  'p-1.5 rounded-lg transition-colors',
                                  showLiveRead
                                    ? 'text-amber-600 bg-amber-50'
                                    : 'text-gray-400 hover:bg-amber-50 hover:text-amber-600'
                                )}
                              >
                                <Activity className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button onClick={() => setFormModal(p)}
                              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(p.id)}
                              className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        {showLiveRead && (
                          <LiveReadPanel
                            deviceId={device.id}
                            peripheral={p}
                            onApplyCal={(field, value) => {
                              const newExtraConfig = {
                                ...(p.extra_config || {}),
                                [field]: value,
                              }
                              setFormModal({ ...p, extra_config: newExtraConfig })
                              setLiveReadId(null)
                            }}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Push config */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-medium text-gray-700">Enviar al dispositiu</p>
                  <p className="text-xs text-gray-400 mt-0.5">Publica la config via MQTT. L'ESP32 la desarà i es reiniciarà.</p>
                </div>
                <button onClick={handlePush} disabled={pushing}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 transition-colors flex-shrink-0">
                  {pushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {pushing ? 'Enviant...' : 'Enviar config'}
                </button>
              </div>
              {pushResult && (
                <p className="mt-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                  Publicat — {pushResult.peripherals} perifèrics · {pushResult.zones} zones · {pushResult.tanks} dipòsits
                </p>
              )}
              {pushError && (
                <p className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">{pushError}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {formModal !== null && (
        <PeripheralFormModal
          deviceId={device.id}
          peripheral={formModal === 'create' ? null : formModal}
          onClose={() => setFormModal(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  )
}

// ─── DeviceCard ───────────────────────────────────────────────────────────────

function DeviceCard({ device, onUpdated, onDeleted }) {
  const [editing,       setEditing]       = useState(false)
  const [name,          setName]          = useState(device.name)
  const [saving,        setSaving]        = useState(false)
  const [deleting,      setDeleting]      = useState(false)
  const [savingInterval, setSavingInterval] = useState(false)
  const [showHwModal,   setShowHwModal]   = useState(false)

  async function handleSaveName() {
    if (!name.trim() || name === device.name) { setEditing(false); return }
    setSaving(true)
    try {
      const updated = await updateDevice(device.id, { name })
      onUpdated(updated)
      setEditing(false)
    } catch { /* silent */ } finally {
      setSaving(false)
    }
  }

  async function handlePollIntervalChange(e) {
    const newInterval = parseInt(e.target.value, 10)
    if (newInterval === device.poll_interval_seconds) return
    setSavingInterval(true)
    try {
      const updated = await updateDevice(device.id, { poll_interval_seconds: newInterval })
      onUpdated(updated)
    } catch { /* silent */ } finally {
      setSavingInterval(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Eliminar "${device.name}"? Les zones assignades quedaran sense dispositiu.`)) return
    setDeleting(true)
    try {
      await deleteDevice(device.id)
      onDeleted(device.id)
    } catch { setDeleting(false) }
  }

  const currentInterval = device.poll_interval_seconds ?? 300
  const nearestOption = POLL_OPTIONS.find(o => o.value === currentInterval)?.value
    ?? POLL_OPTIONS.reduce((a, b) =>
        Math.abs(b.value - currentInterval) < Math.abs(a.value - currentInterval) ? b : a
      ).value

  return (
    <>
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={clsx(
              'flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center',
              device.online ? 'bg-green-100' : 'bg-gray-100'
            )}>
              <Cpu className={clsx('w-5 h-5', device.online ? 'text-green-600' : 'text-gray-400')} />
            </div>
            <div className="min-w-0 flex-1">
              {editing ? (
                <div className="flex items-center gap-2">
                  <input autoFocus type="text" value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setEditing(false); setName(device.name) } }}
                    className="font-semibold text-gray-900 border-b border-green-400 outline-none bg-transparent flex-1" />
                  <button onClick={handleSaveName} disabled={saving} className="p-1 text-green-600 hover:bg-green-50 rounded">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button onClick={() => { setEditing(false); setName(device.name) }} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button onClick={() => setEditing(true)}
                  className="font-semibold text-gray-900 hover:text-green-600 transition-colors text-left group flex items-center gap-1.5">
                  {device.name}
                  <Pencil className="w-3.5 h-3.5 text-gray-300 group-hover:text-green-400 transition-colors" />
                </button>
              )}
              <p className="text-xs text-gray-400 font-mono mt-0.5">{device.mac_address}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className={clsx(
              'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
              device.online ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            )}>
              {device.online
                ? <><Wifi className="w-3.5 h-3.5" /> En línia</>
                : <><WifiOff className="w-3.5 h-3.5" /> Fora de línia</>}
            </div>
            <button onClick={handleDelete} disabled={deleting}
              className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="px-6 py-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Firmware</p>
            <p className="font-medium text-gray-700">{device.firmware_version ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Última activitat</p>
            <p className="font-medium text-gray-700">{timeAgo(device.last_seen) ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Registrat</p>
            <p className="font-medium text-gray-700">
              {new Date(device.registered_at).toLocaleDateString('ca', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">ID intern</p>
            <p className="font-medium text-gray-700">#{device.id}</p>
          </div>
        </div>

        {/* Polling interval */}
        <div className="px-6 py-4 border-t border-gray-100">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-700">Freqüència de lectura</p>
                <p className="text-xs text-gray-400">Cada quant s'obtenen dades dels sensors</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {savingInterval && <Loader2 className="w-3.5 h-3.5 animate-spin text-green-500" />}
              <select value={nearestOption} onChange={handlePollIntervalChange} disabled={savingInterval}
                className={clsx(
                  'text-sm font-medium rounded-lg border px-3 py-1.5 outline-none transition-colors cursor-pointer',
                  savingInterval
                    ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
                    : 'border-gray-200 text-gray-700 bg-white hover:border-green-400 focus:border-green-500 focus:ring-1 focus:ring-green-200'
                )}>
                {POLL_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Zones + Hardware config button */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Zones assignades
            </p>
            {device.zones.length === 0 ? (
              <p className="text-xs text-gray-400">Cap zona assignada</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {device.zones.map(z => (
                  <span key={z.id} className="text-xs px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-600 font-medium">
                    {z.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setShowHwModal(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-gray-600 border border-gray-200 bg-white hover:border-green-400 hover:text-green-600 transition-colors flex-shrink-0">
            <Settings2 className="w-3.5 h-3.5" />
            Hardware
          </button>
        </div>
      </div>

      {showHwModal && (
        <HardwareConfigModal device={device} onClose={() => setShowHwModal(false)} />
      )}
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Devices() {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await fetchDevices()
      setDevices(data)
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [load])

  const update = (updated) => setDevices(prev => prev.map(d => d.id === updated.id ? updated : d))
  const remove  = (id)     => setDevices(prev => prev.filter(d => d.id !== id))

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

  const online = devices.filter(d => d.online).length

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm">
        <span className="text-gray-500">{devices.length} dispositiu{devices.length !== 1 ? 's' : ''}</span>
        <span className="w-1 h-1 rounded-full bg-gray-300" />
        <span className={clsx('font-medium', online > 0 ? 'text-green-600' : 'text-gray-400')}>
          {online} en línia
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {devices.map(device => (
          <DeviceCard key={device.id} device={device} onUpdated={update} onDeleted={remove} />
        ))}
      </div>
    </div>
  )
}
