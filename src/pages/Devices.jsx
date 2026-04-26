import { useState, useEffect, useCallback } from 'react'
import { Cpu, Wifi, WifiOff, Pencil, Trash2, Check, X, Loader2, Layers } from 'lucide-react'
import clsx from 'clsx'
import { fetchDevices, updateDevice, deleteDevice } from '../api/devices'

function timeAgo(isoString) {
  if (!isoString) return null
  const diff = Math.round((Date.now() - new Date(isoString)) / 1000)
  if (diff < 60) return `Fa ${diff} s`
  if (diff < 3600) return `Fa ${Math.round(diff / 60)} min`
  if (diff < 86400) return `Fa ${Math.round(diff / 3600)} h`
  return `Fa ${Math.round(diff / 86400)} d`
}

function DeviceCard({ device, onUpdated, onDeleted }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(device.name)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  async function handleDelete() {
    if (!confirm(`Eliminar "${device.name}"? Les zones assignades quedaran sense dispositiu.`)) return
    setDeleting(true)
    try {
      await deleteDevice(device.id)
      onDeleted(device.id)
    } catch { setDeleting(false) }
  }

  return (
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
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setEditing(false); setName(device.name) } }}
                  className="font-semibold text-gray-900 border-b border-green-400 outline-none bg-transparent flex-1"
                />
                <button onClick={handleSaveName} disabled={saving} className="p-1 text-green-600 hover:bg-green-50 rounded">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
                <button onClick={() => { setEditing(false); setName(device.name) }} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="font-semibold text-gray-900 hover:text-green-600 transition-colors text-left group flex items-center gap-1.5"
              >
                {device.name}
                <Pencil className="w-3.5 h-3.5 text-gray-300 group-hover:text-green-400 transition-colors" />
              </button>
            )}
            <p className="text-xs text-gray-400 font-mono mt-0.5">{device.mac_address}</p>
          </div>
        </div>

        {/* Status + delete */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className={clsx(
            'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
            device.online ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          )}>
            {device.online
              ? <><Wifi className="w-3.5 h-3.5" /> En línia</>
              : <><WifiOff className="w-3.5 h-3.5" /> Fora de línia</>
            }
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
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

      {/* Zones */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
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
    </div>
  )
}

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

  // Refresca l'estat online cada 30 s sense recarregar la pàgina sencera
  useEffect(() => {
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [load])

  const update = (updated) => setDevices(prev => prev.map(d => d.id === updated.id ? updated : d))
  const remove = (id) => setDevices(prev => prev.filter(d => d.id !== id))

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
      {/* Summary */}
      <div className="flex items-center gap-3 text-sm">
        <span className="text-gray-500">{devices.length} dispositiu{devices.length !== 1 ? 's' : ''}</span>
        <span className="w-1 h-1 rounded-full bg-gray-300" />
        <span className={clsx('font-medium', online > 0 ? 'text-green-600' : 'text-gray-400')}>
          {online} en línia
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {devices.map(device => (
          <DeviceCard
            key={device.id}
            device={device}
            onUpdated={update}
            onDeleted={remove}
          />
        ))}
      </div>
    </div>
  )
}
