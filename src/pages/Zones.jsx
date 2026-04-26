import { useState, useEffect, useCallback } from 'react'
import { Droplets, Settings, Sliders, Cpu, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import clsx from 'clsx'
import { fetchZones, updateZone, updateZoneConfig } from '../api/zones'
import { fetchDevices, assignZoneDevice } from '../api/devices'

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex w-11 h-6 rounded-full transition-colors focus:outline-none min-w-[44px] min-h-[44px] items-center justify-start pl-0.5',
        checked ? 'bg-green-500' : 'bg-gray-300'
      )}
    >
      <span className={clsx(
        'w-5 h-5 bg-white rounded-full shadow transition-transform',
        checked && 'translate-x-5'
      )} />
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

function NumberField({ value, onChange, unit, min, max, step = 1 }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={e => onChange(Number(e.target.value))}
        className="w-20 text-right px-2 py-1 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
      />
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

function ZoneConfigCard({ zone, devices, onSaved }) {
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null) // 'ok' | 'error'

  useEffect(() => {
    setForm({
      name: zone.name,
      active: zone.active,
      device_id: zone.device_id ?? '',
      humidity_min: zone.config?.humidity_min ?? 30,
      humidity_max: zone.config?.humidity_max ?? 80,
      max_temp_to_water: zone.config?.max_temp_to_water ?? 38,
      cooldown_hours: zone.config?.cooldown_hours ?? 2,
      soil_dry_value: zone.config?.soil_dry_value ?? 3800,
      soil_wet_value: zone.config?.soil_wet_value ?? 1200,
    })
  }, [zone])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  async function handleSave() {
    setSaving(true)
    setStatus(null)
    try {
      const newDeviceId = form.device_id === '' ? null : Number(form.device_id)
      await Promise.all([
        updateZone(zone.id, { name: form.name, active: form.active }),
        updateZoneConfig(zone.id, {
          humidity_min: form.humidity_min,
          humidity_max: form.humidity_max,
          max_temp_to_water: form.max_temp_to_water,
          cooldown_hours: form.cooldown_hours,
          soil_dry_value: form.soil_dry_value,
          soil_wet_value: form.soil_wet_value,
        }),
        ...(newDeviceId !== zone.device_id
          ? [assignZoneDevice(zone.id, newDeviceId)]
          : []),
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

  if (!form) return null

  return (
    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <Droplets className="w-5 h-5 text-green-600" />
          </div>
          <div className="min-w-0">
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className="font-semibold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-green-400 outline-none w-full transition-colors"
            />
            <p className="text-xs text-gray-400">
              Sensors GPIO {zone.soil_pin_a_local}/{zone.soil_pin_b_local} · Relé GPIO {zone.relay_pin_local}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm text-gray-500 hidden sm:block">{form.active ? 'Activa' : 'Desactivada'}</span>
          <Toggle checked={form.active} onChange={v => set('active', v)} />
        </div>
      </div>

      {/* Config fields */}
      <div className={clsx('px-6 py-2', !form.active && 'opacity-40 pointer-events-none')}>
        <SectionHeader icon={Cpu} label="Dispositiu" />
        <FieldRow label="ESP32 assignat">
          <select
            value={form.device_id}
            onChange={e => set('device_id', e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none max-w-[200px]"
          >
            <option value="">Sense dispositiu</option>
            {devices.map(d => (
              <option key={d.id} value={d.id}>
                {d.name}{d.online ? ' ●' : ' ○'}
              </option>
            ))}
          </select>
        </FieldRow>

        <SectionHeader icon={Droplets} label="Humitat" />
        <FieldRow label="Mínima — regar si per sota de">
          <NumberField value={form.humidity_min} onChange={v => set('humidity_min', v)} unit="%" min={0} max={100} />
        </FieldRow>
        <FieldRow label="Màxima — aturar si per sobre de">
          <NumberField value={form.humidity_max} onChange={v => set('humidity_max', v)} unit="%" min={0} max={100} />
        </FieldRow>

        <SectionHeader icon={Settings} label="Paràmetres de reg" />
        <FieldRow label="Cooldown entre regs">
          <NumberField value={form.cooldown_hours} onChange={v => set('cooldown_hours', v)} unit="h" min={0} max={48} step={0.5} />
        </FieldRow>
        <FieldRow label="Temperatura màxima per regar">
          <NumberField value={form.max_temp_to_water} onChange={v => set('max_temp_to_water', v)} unit="°C" min={0} max={60} />
        </FieldRow>

        <SectionHeader icon={Sliders} label="Calibratge del sensor" />
        <FieldRow label="Valor ADC en sec (aire)">
          <NumberField value={form.soil_dry_value} onChange={v => set('soil_dry_value', v)} min={0} max={4095} />
        </FieldRow>
        <FieldRow label="Valor ADC en mullat (aigua)">
          <NumberField value={form.soil_wet_value} onChange={v => set('soil_wet_value', v)} min={0} max={4095} />
        </FieldRow>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          {status === 'ok' && (
            <>
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-green-600">Desat correctament</span>
            </>
          )}
          {status === 'error' && (
            <>
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-red-600">Error en desar</span>
            </>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors min-h-[44px]"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Desar canvis
        </button>
      </div>
    </div>
  )
}

export default function Zones() {
  const [zones, setZones] = useState([])
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      const [z, d] = await Promise.all([fetchZones(), fetchDevices()])
      setZones(z)
      setDevices(d)
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
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {zones.map(zone => (
        <ZoneConfigCard key={zone.id} zone={zone} devices={devices} onSaved={load} />
      ))}
    </div>
  )
}
