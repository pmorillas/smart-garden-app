import { useState, useEffect, useMemo } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { Loader2, Trash2, Database } from 'lucide-react'
import clsx from 'clsx'
import { fetchZones, getZoneHistory, cleanupHistory } from '../api/zones'
import { getAmbientHistory } from '../api/sensors'

const ZONE_COLORS = ['#3b82f6', '#06b6d4', '#8b5cf6', '#22c55e', '#f97316']
const TRIGGER_LABELS = { manual: 'Manual', schedule: 'Horari', sensor: 'Sensor' }
const SKIP_REASON_LABELS = {
  humidity_ok:       'Humitat suficient',
  cooldown_active:   'Cooldown actiu',
  too_hot:           'Temperatura massa alta',
  tank_empty:        'Dipòsit buit',
  already_watering:  'Ja regant',
  condition_not_met: 'Condició no complida',
}

const HOUR_OPTIONS = [
  { value: 24, label: '24 h' },
  { value: 48, label: '48 h' },
  { value: 168, label: '7 d' },
]

const SERIES_OPTIONS = [
  { value: 'soil', label: 'Humitat terra' },
  { value: 'humidity', label: 'Humitat exterior' },
  { value: 'temperature', label: 'Temperatura' },
  { value: 'light', label: 'Lluminositat' },
]

function TabGroup({ options, value, onChange }) {
  return (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={clsx(
            'px-3 py-1.5 transition-colors min-h-[36px]',
            value === opt.value ? 'bg-green-500 text-white' : 'text-gray-500 hover:bg-gray-50'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// Multi-select toggle: mínim 1 actiu sempre
function SeriesToggle({ options, value, onChange }) {
  return (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={clsx(
            'px-3 py-1.5 transition-colors min-h-[36px]',
            value.has(opt.value) ? 'bg-green-500 text-white' : 'text-gray-500 hover:bg-gray-50'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function formatDuration(seconds) {
  if (!seconds) return '—'
  if (seconds < 60) return `${seconds} s`
  return `${Math.round(seconds / 60)} min`
}

function formatDatetime(isoString) {
  if (!isoString) return '—'
  const d = new Date(isoString)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const time = d.toLocaleTimeString('ca', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === today.toDateString()) return `Avui ${time}`
  if (d.toDateString() === yesterday.toDateString()) return `Ahir ${time}`
  return d.toLocaleDateString('ca', { day: '2-digit', month: '2-digit' }) + ' ' + time
}

function toChartTime(ts) {
  return new Date(ts).toLocaleTimeString('ca', { hour: '2-digit', minute: '2-digit' })
}

function mergeAllData({ zoneHistories, ambientHistory, activeSeries }) {
  const map = new Map()
  const bucket = (isoString) => {
    const key = Math.round(new Date(isoString).getTime() / 60000) * 60000
    if (!map.has(key)) map.set(key, { ts: key })
    return map.get(key)
  }

  if (activeSeries.has('soil')) {
    zoneHistories.forEach(({ zoneId, soil_readings }) => {
      ;(soil_readings ?? []).forEach(r => { bucket(r.timestamp)[`z${zoneId}`] = r.value })
    })
  }
  if (activeSeries.has('humidity')) {
    ;(ambientHistory?.ambient_humidity ?? []).forEach(r => { bucket(r.timestamp).ambient_humidity = r.value })
  }
  if (activeSeries.has('temperature')) {
    ;(ambientHistory?.temperature ?? []).forEach(r => { bucket(r.timestamp).temperature = r.value })
  }
  if (activeSeries.has('light')) {
    ;(ambientHistory?.light_lux ?? []).forEach(r => { bucket(r.timestamp).light_lux = r.value })
  }

  return Array.from(map.values())
    .sort((a, b) => a.ts - b.ts)
    .map(pt => ({ ...pt, time: toChartTime(pt.ts) }))
}

function CleanupRow({ category, label }) {
  const [deleting, setDeleting] = useState(false)
  const [date, setDate] = useState('')

  async function handleCleanup() {
    if (!date) return
    if (!confirm(`Esborrar ${label} anteriors a ${new Date(date + 'T23:59:59').toLocaleDateString('ca')}?`)) return
    setDeleting(true)
    try {
      const olderThan = new Date(date + 'T23:59:59').toISOString()
      await cleanupHistory(category, olderThan)
      setDate('')
      window.location.reload()
    } catch {
      setDeleting(false)
      alert(`Error en esborrar ${label.toLowerCase()}`)
    }
  }

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0 gap-4">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        <button
          onClick={handleCleanup}
          disabled={!date || deleting}
          title="Esborrar dades antigues"
          className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed min-w-[36px] min-h-[36px] flex items-center justify-center"
        >
          {deleting
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Trash2 className="w-4 h-4" />
          }
        </button>
      </div>
    </div>
  )
}

export default function History() {
  const [zones, setZones] = useState([])
  const [zoneHistories, setZoneHistories] = useState([])
  const [ambientHistory, setAmbientHistory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeZone, setActiveZone] = useState('all')
  const [hours, setHours] = useState(24)
  const [activeSeries, setActiveSeries] = useState(new Set(['soil']))

  const toggleSeries = (val) => {
    setActiveSeries(prev => {
      const next = new Set(prev)
      if (next.has(val) && next.size > 1) next.delete(val)
      else next.add(val)
      return next
    })
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    fetchZones()
      .then(allZones => {
        if (cancelled) return
        setZones(allZones)
        return Promise.all([
          ...allZones.map(z =>
            getZoneHistory(z.id, hours).then(h => ({ ...h, zoneId: z.id, zoneName: z.name }))
          ),
          getAmbientHistory(hours),
        ]).then(results => {
          if (cancelled) return
          setAmbientHistory(results[results.length - 1])
          setZoneHistories(results.slice(0, allZones.length))
          setLoading(false)
        })
      })
      .catch(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [hours])

  const chartData = useMemo(
    () => mergeAllData({ zoneHistories, ambientHistory, activeSeries }),
    [zoneHistories, ambientHistory, activeSeries]
  )

  const allEvents = useMemo(() =>
    zoneHistories
      .flatMap(h => (h.watering_events ?? []).map(e => ({ ...e, zone_id: h.zoneId, zone_name: h.zoneName })))
      .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
      .slice(0, 20),
    [zoneHistories]
  )

  const zoneOptions = [
    { value: 'all', label: 'Totes' },
    ...zones.map(z => ({ value: String(z.id), label: z.name })),
  ]

  const visibleZones = activeZone === 'all'
    ? zones
    : zones.filter(z => String(z.id) === activeZone)

  const hasSoil    = activeSeries.has('soil')
  const hasAmbient = activeSeries.has('humidity') || activeSeries.has('temperature') || activeSeries.has('light')
  const hasData    = chartData.length > 0

  const ambientCount = [activeSeries.has('humidity'), activeSeries.has('temperature'), activeSeries.has('light')].filter(Boolean).length
  const rightUnit = ambientCount > 1
    ? ''
    : activeSeries.has('temperature') ? '°C'
    : activeSeries.has('humidity') ? '%'
    : activeSeries.has('light') ? 'lux'
    : ''

  const tooltipFormatter = (val, name) => {
    if (name === 'ambient_humidity') return [`${val?.toFixed(1)}%`, 'Humitat exterior']
    if (name === 'temperature')      return [`${val?.toFixed(1)}°C`, 'Temperatura']
    if (name === 'light_lux')        return [`${Math.round(val)} lux`, 'Lluminositat']
    const zone = zones.find(z => `z${z.id}` === name)
    return [`${val?.toFixed(1)}%`, zone?.name ?? name]
  }

  return (
    <div className="space-y-6">
      {/* Chart */}
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-gray-900">Historial de sensors</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SeriesToggle value={activeSeries} onChange={toggleSeries} options={SERIES_OPTIONS} />
            {hasSoil && (
              <TabGroup value={activeZone} onChange={setActiveZone} options={zoneOptions} />
            )}
            <TabGroup
              value={String(hours)}
              onChange={v => setHours(Number(v))}
              options={HOUR_OPTIONS.map(o => ({ ...o, value: String(o.value) }))}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-[280px]">
            <Loader2 className="w-6 h-6 animate-spin text-green-400" />
          </div>
        ) : !hasData ? (
          <div className="flex items-center justify-center h-[280px] text-center">
            <div>
              <p className="text-sm font-medium text-gray-400">Sense dades</p>
              <p className="text-xs text-gray-300 mt-1">Connecta l'ESP32 per veure lectures</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 5, right: hasAmbient ? 60 : 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                interval="preserveStartEnd"
              />

              {/* Eix esquerre: humitat terra % */}
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                unit="%"
                domain={[0, 100]}
                width={40}
                hide={!hasSoil}
              />

              {/* Eix dret: temperatura / lluminositat */}
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                unit={rightUnit}
                domain={['auto', 'auto']}
                width={hasAmbient ? 55 : 0}
                hide={!hasAmbient}
              />

              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 10,
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,.05)',
                }}
                formatter={tooltipFormatter}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />

              {hasSoil && visibleZones.map((zone, i) => (
                <Line
                  key={zone.id}
                  yAxisId="left"
                  type="monotone"
                  dataKey={`z${zone.id}`}
                  name={zone.name}
                  stroke={ZONE_COLORS[i % ZONE_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
              ))}

              {activeSeries.has('humidity') && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="ambient_humidity"
                  name="ambient_humidity"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="4 2"
                  connectNulls={false}
                />
              )}

              {activeSeries.has('temperature') && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="temperature"
                  name="temperature"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="5 3"
                  connectNulls={false}
                />
              )}

              {activeSeries.has('light') && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="light_lux"
                  name="light_lux"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="3 3"
                  connectNulls={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}

        {/* Llegenda d'eixos quan hi ha overlay */}
        {hasSoil && hasAmbient && (
          <div className="flex gap-4 mt-3 text-xs text-gray-400 justify-end">
            <span>← eix esquerre: humitat terra (%)</span>
            <span>eix dret: {
              [
                activeSeries.has('humidity') && 'humitat exterior (%)',
                activeSeries.has('temperature') && 'temperatura (°C)',
                activeSeries.has('light') && 'lluminositat (lux)',
              ].filter(Boolean).join(' / ')
            } →</span>
          </div>
        )}
      </div>

      {/* Events table */}
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Events de reg recents</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-green-400" />
          </div>
        ) : allEvents.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-400">Cap event de reg registrat</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left bg-gray-50">
                  <th className="px-4 md:px-6 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Hora</th>
                  <th className="px-4 md:px-6 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Zona</th>
                  <th className="px-4 md:px-6 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Durada</th>
                  <th className="px-4 md:px-6 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide hidden sm:table-cell">Trigger</th>
                  <th className="px-4 md:px-6 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Estat / Motiu</th>
                </tr>
              </thead>
              <tbody>
                {allEvents.map(ev => {
                  const isSkipped = ev.outcome === 'skipped'
                  return (
                    <tr
                      key={ev.id}
                      className={clsx(
                        'border-b border-gray-50 hover:bg-gray-50/60 transition-colors',
                        isSkipped && 'opacity-75'
                      )}
                    >
                      <td className="px-4 md:px-6 py-3.5 text-gray-600">{formatDatetime(ev.started_at)}</td>
                      <td className="px-4 md:px-6 py-3.5">
                        <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                          {ev.zone_name}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-3.5 text-gray-600">
                        {isSkipped ? '—' : formatDuration(ev.duration_seconds)}
                      </td>
                      <td className="px-4 md:px-6 py-3.5 text-gray-500 hidden sm:table-cell">
                        {TRIGGER_LABELS[ev.trigger_type] ?? ev.trigger_type}
                      </td>
                      <td className="px-4 md:px-6 py-3.5">
                        {isSkipped ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 w-fit">
                              Saltat
                            </span>
                            {ev.skip_reason && (
                              <span className="text-xs text-gray-400">
                                {SKIP_REASON_LABELS[ev.skip_reason] ?? ev.skip_reason}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className={clsx(
                            'px-2 py-0.5 rounded-full text-xs font-medium',
                            ev.ended_at ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                          )}>
                            {ev.ended_at ? 'Completat' : 'Actiu'}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Data maintenance */}
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Database className="w-4 h-4 text-gray-400" />
          <h2 className="font-semibold text-gray-900">Manteniment de dades</h2>
        </div>
        <div className="px-6 py-2">
          <CleanupRow category="sensor_readings" label="Lectures de sensors" />
          <CleanupRow category="watering_events" label="Events de reg" />
        </div>
      </div>
    </div>
  )
}
