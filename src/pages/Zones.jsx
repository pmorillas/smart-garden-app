import { useState, useEffect, useCallback } from 'react'
import {
  Droplets, Settings, Cpu, Loader2, CheckCircle,
  AlertCircle, Plus, Trash2, X, WifiOff, CircuitBoard,
} from 'lucide-react'
import clsx from 'clsx'
import { fetchZones, createZone, updateZone, updateZoneConfig, deleteZone } from '../api/zones'
import { fetchDevices, assignZoneDevice } from '../api/devices'
import { fetchTanks } from '../api/tanks'
import { fetchPeripherals, assignZoneRelay, assignZoneSoil, pushHardwareConfig } from '../api/peripherals'

// ─── Shared components ────────────────────────────────────────────────────────

function Toggle({ checked, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={clsx('relative inline-flex w-11 h-6 rounded-full transition-colors focus:outline-none',
        checked ? 'bg-green-500' : 'bg-gray-300')}>
      <span className={clsx('absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform', checked && 'translate-x-5')} />
    </button>
  )
}

function FieldRow({ label, children }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0 gap-4">
      <span className="text-sm text-gray-600 flex-1">{label}</span>
      {children}
    </div>
  )
}

function NumberField({ value, onChange, unit, min, max, step = 1, placeholder }) {
  return (
    <div className="flex items-center gap-2">
      <input type="number" value={value ?? ''} min={min} max={max} step={step} placeholder={placeholder}
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="w-20 text-right px-2 py-1 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
      {unit && <span className="text-sm text-gray-400 w-8">{unit}</span>}
    </div>
  )
}

function SectionHeader({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-1.5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400 mt-2">
      <Icon className="w-3.5 h-3.5" />
      {label}
    </div>
  )
}

const AGGREGATION_OPTIONS = [
  { value: 'AVG',       label: 'Mitjana (AVG)' },
  { value: 'ANY_BELOW', label: 'Qualsevol per sota' },
  { value: 'ALL_BELOW', label: 'Tots per sota' },
]

// ─── CreateZoneModal ──────────────────────────────────────────────────────────

function CreateZoneModal({ devices, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', device_id: '' })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  async function handleCreate() {
    if (!form.name.trim()) { setError('El nom és obligatori'); return }
    setSaving(true)
    setError(null)
    try {
      await createZone({
        name:      form.name.trim(),
        device_id: form.device_id ? Number(form.device_id) : null,
      })
      onCreated()
      onClose()
    } catch (e) {
      setError(e.response?.data?.detail ?? 'Error en crear la zona')
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
            <h2 className="font-semibold text-gray-900">Nova zona</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom</label>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="Ex: Zona jardí"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ESP32 assignat</label>
              <select value={form.device_id} onChange={e => set('device_id', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none">
                <option value="">Sense dispositiu</option>
                {devices.map(d => (
                  <option key={d.id} value={d.id}>{d.name}{d.online ? ' ●' : ' ○'}</option>
                ))}
              </select>
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
            <button onClick={handleCreate} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors min-w-[100px] justify-center">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Crear zona
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── HardwareSection ──────────────────────────────────────────────────────────

function HardwareSection({ zone, devices, onDeviceChanged }) {
  const [deviceId,  setDeviceId]  = useState(String(zone.device_id ?? ''))
  const [peripherals, setPeripherals] = useState([])
  const [loadingP,  setLoadingP]  = useState(false)
  const [relayId,   setRelayId]   = useState(String(zone.relay_peripheral_id ?? ''))
  const [soilIds,   setSoilIds]   = useState(zone.soil_peripheral_ids ?? [])
  const [aggMode,   setAggMode]   = useState(zone.soil_aggregation_mode ?? 'AVG')
  const [saving,    setSaving]    = useState(false)
  const [status,    setStatus]    = useState(null) // 'ok' | 'error' | 'pushing'

  // Load peripherals when device changes
  useEffect(() => {
    if (!deviceId) { setPeripherals([]); return }
    setLoadingP(true)
    fetchPeripherals(Number(deviceId))
      .then(setPeripherals)
      .catch(() => setPeripherals([]))
      .finally(() => setLoadingP(false))
  }, [deviceId])

  // Reset peripheral selection when device changes
  function handleDeviceChange(newId) {
    if (newId !== deviceId) {
      setRelayId('')
      setSoilIds([])
    }
    setDeviceId(newId)
  }

  function toggleSoil(id) {
    setSoilIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const relays      = peripherals.filter(p => p.type === 'RELAY')
  const soilSensors = peripherals.filter(p => p.type === 'SOIL_ADC')

  async function handleSave() {
    setSaving(true)
    setStatus(null)
    try {
      const newDeviceId = deviceId === '' ? null : Number(deviceId)
      const calls = []

      if (newDeviceId !== zone.device_id) {
        calls.push(assignZoneDevice(zone.id, newDeviceId))
      }

      if (newDeviceId) {
        calls.push(
          assignZoneRelay(newDeviceId, {
            zone_id: zone.id,
            peripheral_id: relayId !== '' ? parseInt(relayId) : null,
          }),
          assignZoneSoil(newDeviceId, {
            zone_id: zone.id,
            peripheral_ids: soilIds,
            aggregation_mode: aggMode,
          }),
        )
      }

      await Promise.all(calls)

      if (newDeviceId) {
        setStatus('pushing')
        await pushHardwareConfig(newDeviceId)
      }

      setStatus('ok')
      onDeviceChanged()
      setTimeout(() => setStatus(null), 3000)
    } catch {
      setStatus('error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-1">
      {/* Device selector */}
      <FieldRow label="Dispositiu ESP32">
        <select value={deviceId} onChange={e => handleDeviceChange(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none max-w-[200px]">
          <option value="">Sense dispositiu</option>
          {devices.map(d => (
            <option key={d.id} value={d.id}>{d.name}{d.online ? ' ●' : ' ○'}</option>
          ))}
        </select>
      </FieldRow>

      {/* Relay */}
      <FieldRow label="Relé de reg">
        {loadingP ? (
          <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
        ) : (
          <select value={relayId} onChange={e => setRelayId(e.target.value)} disabled={!deviceId}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none max-w-[200px] disabled:opacity-40">
            <option value="">— Cap —</option>
            {relays.map(r => (
              <option key={r.id} value={r.id}>{r.name}{r.pin1 != null ? ` (GPIO${r.pin1})` : ''}</option>
            ))}
          </select>
        )}
      </FieldRow>

      {/* Soil sensors */}
      <div className="py-3 border-b border-gray-50">
        <div className="flex items-start justify-between gap-4">
          <span className="text-sm text-gray-600 pt-0.5">Sensors d'humitat</span>
          {loadingP ? (
            <Loader2 className="w-4 h-4 animate-spin text-gray-300 mt-0.5" />
          ) : !deviceId ? (
            <span className="text-xs text-gray-300 italic">Selecciona un dispositiu</span>
          ) : soilSensors.length === 0 ? (
            <span className="text-xs text-gray-300 italic">Cap sensor SOIL_ADC</span>
          ) : (
            <div className="flex flex-col items-end gap-1.5">
              {soilSensors.map(s => (
                <label key={s.id} className="flex items-center gap-2 cursor-pointer select-none">
                  <span className="text-sm text-gray-700">{s.name}</span>
                  <input type="checkbox" checked={soilIds.includes(s.id)} onChange={() => toggleSoil(s.id)}
                    className="rounded border-gray-300 text-green-500 focus:ring-green-400" />
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Aggregation mode */}
      {soilIds.length > 1 && (
        <div className="py-3 border-b border-gray-50">
          <div className="flex items-start justify-between gap-4">
            <span className="text-sm text-gray-600 pt-0.5">Mode d'agregació</span>
            <div className="flex flex-col items-end gap-1.5">
              {AGGREGATION_OPTIONS.map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer select-none">
                  <span className="text-sm text-gray-700">{opt.label}</span>
                  <input type="radio" name={`agg-${zone.id}`} value={opt.value}
                    checked={aggMode === opt.value} onChange={() => setAggMode(opt.value)}
                    className="text-green-500 focus:ring-green-400" />
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Save hardware */}
      <div className="pt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          {status === 'ok'     && <><CheckCircle className="w-4 h-4 text-green-500" /><span className="text-green-600">Desat i enviat</span></>}
          {status === 'error'  && <><AlertCircle className="w-4 h-4 text-red-500"   /><span className="text-red-600">Error en desar</span></>}
          {status === 'pushing'&& <><Loader2 className="w-4 h-4 animate-spin text-amber-500" /><span className="text-amber-600">Enviant a ESP32…</span></>}
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Desa hardware
        </button>
      </div>
    </div>
  )
}

// ─── ZoneConfigCard ───────────────────────────────────────────────────────────

function ZoneConfigCard({ zone, devices, tanks, onSaved, onDeleted }) {
  const [form,     setForm]     = useState(null)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [status,   setStatus]   = useState(null) // 'ok' | 'error'

  useEffect(() => {
    setForm({
      name:              zone.name,
      active:            zone.active,
      tank_id:           zone.tank_id ?? '',
      humidity_min:      zone.config?.humidity_min      ?? 30,
      humidity_max:      zone.config?.humidity_max      ?? 80,
      max_temp_to_water: zone.config?.max_temp_to_water ?? 38,
      cooldown_hours:    zone.config?.cooldown_hours    ?? 2,
    })
  }, [zone])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  async function handleSave() {
    setSaving(true)
    setStatus(null)
    try {
      await Promise.all([
        updateZone(zone.id, { name: form.name, active: form.active, tank_id: form.tank_id === '' ? null : Number(form.tank_id) }),
        updateZoneConfig(zone.id, {
          humidity_min:      form.humidity_min,
          humidity_max:      form.humidity_max,
          max_temp_to_water: form.max_temp_to_water,
          cooldown_hours:    form.cooldown_hours,
        }),
      ])
      setStatus('ok')
      onSaved()
      setTimeout(() => setStatus(null), 3000)
    } catch {
      setStatus('error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Eliminar la zona "${zone.name}"? S'esborrarà tot l'historial i programes associats.`)) return
    setDeleting(true)
    try {
      await deleteZone(zone.id)
      onDeleted()
    } catch {
      setDeleting(false)
      alert('Error en eliminar la zona')
    }
  }

  if (!form) return null

  const assignedDevice = devices.find(d => d.id === zone.device_id)

  return (
    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <Droplets className="w-5 h-5 text-green-600" />
          </div>
          <div className="min-w-0">
            <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
              className="font-semibold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-green-400 outline-none w-full transition-colors" />
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-gray-400">
                {assignedDevice ? assignedDevice.name : 'Sense dispositiu'}
              </p>
              {!zone.config_synced && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
                  <WifiOff className="w-3 h-3" />
                  Pendent sync
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm text-gray-500 hidden sm:block">{form.active ? 'Activa' : 'Desactivada'}</span>
          <Toggle checked={form.active} onChange={v => set('active', v)} />
          <button onClick={handleDelete} disabled={deleting} title="Eliminar zona"
            className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center">
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Config fields */}
      <div className={clsx('px-6 py-2', !form.active && 'opacity-40 pointer-events-none')}>

        {/* Hardware section */}
        <SectionHeader icon={CircuitBoard} label="Hardware" />
        <HardwareSection zone={zone} devices={devices} onDeviceChanged={onSaved} />

        {/* Tank */}
        <SectionHeader icon={Droplets} label="Dipòsit" />
        <FieldRow label="Dipòsit d'aigua">
          <select value={form.tank_id} onChange={e => set('tank_id', e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none max-w-[200px]">
            <option value="">Sense dipòsit</option>
            {tanks.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </FieldRow>

        {/* Humidity thresholds */}
        <SectionHeader icon={Droplets} label="Humitat" />
        <FieldRow label="Mínima — regar si per sota de">
          <NumberField value={form.humidity_min} onChange={v => set('humidity_min', v)} unit="%" min={0} max={100} />
        </FieldRow>
        <FieldRow label="Màxima — aturar si per sobre de">
          <NumberField value={form.humidity_max} onChange={v => set('humidity_max', v)} unit="%" min={0} max={100} />
        </FieldRow>

        {/* Irrigation params */}
        <SectionHeader icon={Settings} label="Paràmetres de reg" />
        <FieldRow label="Cooldown entre regs">
          <NumberField value={form.cooldown_hours} onChange={v => set('cooldown_hours', v)} unit="h" min={0} max={48} step={0.5} />
        </FieldRow>
        <FieldRow label="Temperatura màxima per regar">
          <NumberField value={form.max_temp_to_water} onChange={v => set('max_temp_to_water', v)} unit="°C" min={0} max={60} />
        </FieldRow>


      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          {status === 'ok'    && <><CheckCircle className="w-4 h-4 text-green-500" /><span className="text-green-600">Desat correctament</span></>}
          {status === 'error' && <><AlertCircle className="w-4 h-4 text-red-500"   /><span className="text-red-600">Error en desar</span></>}
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors min-h-[44px]">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Desar canvis
        </button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Zones() {
  const [zones,      setZones]      = useState([])
  const [devices,    setDevices]    = useState([])
  const [tanks,      setTanks]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    try {
      const [z, d, t] = await Promise.all([fetchZones(), fetchDevices(), fetchTanks()])
      setZones(z)
      setDevices(d)
      setTanks(t)
      setError(null)
    } catch {
      setError("No s'ha pogut carregar les zones")
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
            <h2 className="text-lg font-semibold text-gray-900">Zones de reg</h2>
            <p className="text-sm text-gray-500 mt-0.5">{zones.length} zona{zones.length !== 1 ? 'es' : ''} configurada{zones.length !== 1 ? 'des' : ''}</p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors min-h-[44px]">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nova zona</span>
            <span className="sm:hidden">Nova</span>
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {zones.map(zone => (
            <ZoneConfigCard key={zone.id} zone={zone} devices={devices} tanks={tanks}
              onSaved={load} onDeleted={load} />
          ))}
        </div>

        {zones.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
            <Droplets className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-400">Cap zona configurada</p>
            <p className="text-xs text-gray-300 mt-1">Crea una zona per començar</p>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateZoneModal devices={devices} onClose={() => setShowCreate(false)} onCreated={load} />
      )}
    </>
  )
}
