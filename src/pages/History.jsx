import { useState, useEffect, useMemo } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { Loader2 } from 'lucide-react'
import clsx from 'clsx'
import { fetchZones, getZoneHistory } from '../api/zones'
import { getAmbientHistory } from '../api/sensors'

const ZONE_COLORS = ['#3b82f6', '#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444']
const TRIGGER_LABELS = { manual: 'Manual', schedule: 'Horari', sensor: 'Sensor' }

const HOUR_OPTIONS = [
  { value: 24, label: '24 h' },
  { value: 48, label: '48 h' },
  { value: 168, label: '7 d' },
]

const METRIC_OPTIONS = [
  { value: 'soil', label: 'Humitat terra' },
  { value: 'temperature', label: 'Temperatura' },
  { value: 'light', label: 'Lluminositat' },
]

const METRIC_CONFIG = {
  soil:        { unit: '%',    domain: [0, 100], color: null },
  temperature: { unit: '°C',   domain: ['auto', 'auto'], color: '#ef4444' },
  light:       { unit: ' lux', domain: ['auto', 'auto'], color: '#f59e0b' },
}

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

function toChartTime(isoString) {
  return new Date(isoString).toLocaleTimeString('ca', { hour: '2-digit', minute: '2-digit' })
}

function mergeReadings(historiesByZone) {
  const map = new Map()
  historiesByZone.forEach(({ zoneId, readings }) => {
    readings.forEach(r => {
      const key = Math.round(new Date(r.timestamp).getTime() / 60000) * 60000
      if (!map.has(key)) map.set(key, { ts: key })
      map.get(key)[`z${zoneId}`] = r.value
    })
  })
  return Array.from(map.values())
    .sort((a, b) => a.ts - b.ts)
    .map(pt => ({ ...pt, time: toChartTime(new Date(pt.ts).toISOString()) }))
}

function readingsToChartData(readings) {
  return readings.map(r => ({
    time: toChartTime(r.timestamp),
    value: r.value,
  }))
}

export default function History() {
  const [zones, setZones] = useState([])
  const [zoneHistories, setZoneHistories] = useState([])
  const [ambientHistory, setAmbientHistory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeZone, setActiveZone] = useState('all')
  const [hours, setHours] = useState(24)
  const [metric, setMetric] = useState('soil')

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    fetchZones()
      .then(allZones => {
        if (cancelled) return
        setZones(allZones)

        return Promise.all([
          ...allZones.map(z => getZoneHistory(z.id, hours).then(h => ({ ...h, zoneId: z.id, zoneName: z.name }))),
          getAmbientHistory(hours),
        ]).then(results => {
          if (cancelled) return
          const ambient = results[results.length - 1]
          const histories = results.slice(0, allZones.length)
          setZoneHistories(histories)
          setAmbientHistory(ambient)
          setLoading(false)
        })
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [hours])

  const soilChartData = useMemo(() => {
    if (!zoneHistories.length) return []
    return mergeReadings(
      zoneHistories.map(h => ({ zoneId: h.zoneId, readings: h.soil_readings ?? [] }))
    )
  }, [zoneHistories])

  const temperatureChartData = useMemo(
    () => readingsToChartData(ambientHistory?.temperature ?? []),
    [ambientHistory]
  )

  const lightChartData = useMemo(
    () => readingsToChartData(ambientHistory?.light_lux ?? []),
    [ambientHistory]
  )

  const allEvents = useMemo(() => {
    return zoneHistories
      .flatMap(h => (h.watering_events ?? []).map(e => ({
        ...e,
        zone_id: h.zoneId,
        zone_name: h.zoneName,
      })))
      .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
      .slice(0, 20)
  }, [zoneHistories])

  const zoneOptions = [
    { value: 'all', label: 'Totes' },
    ...zones.map(z => ({ value: String(z.id), label: z.name })),
  ]

  const visibleZones = activeZone === 'all'
    ? zones
    : zones.filter(z => String(z.id) === activeZone)

  const isAmbient = metric !== 'soil'
  const cfg = METRIC_CONFIG[metric]

  const chartData = metric === 'soil'
    ? soilChartData
    : metric === 'temperature'
      ? temperatureChartData
      : lightChartData

  const hasData = chartData.length > 0

  return (
    <div className="space-y-6">
      {/* Chart */}
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h2 className="font-semibold text-gray-900">
            {metric === 'soil' ? 'Evolució de la humitat del terra'
              : metric === 'temperature' ? 'Evolució de la temperatura'
              : 'Evolució de la lluminositat'}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <TabGroup value={metric} onChange={v => { setMetric(v); setActiveZone('all') }} options={METRIC_OPTIONS} />
            {metric === 'soil' && (
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
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                unit={cfg.unit}
                domain={cfg.domain}
                width={metric === 'light' ? 55 : 40}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12, borderRadius: 10,
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,.05)',
                }}
                formatter={val => [`${val?.toFixed(metric === 'light' ? 0 : 1)}${cfg.unit}`]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />

              {isAmbient ? (
                <Line
                  type="monotone"
                  dataKey="value"
                  name={metric === 'temperature' ? 'Temperatura' : 'Lluminositat'}
                  stroke={cfg.color}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
              ) : (
                visibleZones.map((zone, i) => (
                  <Line
                    key={zone.id}
                    type="monotone"
                    dataKey={`z${zone.id}`}
                    name={zone.name}
                    stroke={ZONE_COLORS[i % ZONE_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    unit="%"
                    connectNulls={false}
                  />
                ))
              )}
            </LineChart>
          </ResponsiveContainer>
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
                  <th className="px-4 md:px-6 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Estat</th>
                </tr>
              </thead>
              <tbody>
                {allEvents.map(ev => (
                  <tr key={ev.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 md:px-6 py-3.5 text-gray-600">{formatDatetime(ev.started_at)}</td>
                    <td className="px-4 md:px-6 py-3.5">
                      <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                        {ev.zone_name}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-3.5 text-gray-600">{formatDuration(ev.duration_seconds)}</td>
                    <td className="px-4 md:px-6 py-3.5 text-gray-500 hidden sm:table-cell">
                      {TRIGGER_LABELS[ev.trigger_type] ?? ev.trigger_type}
                    </td>
                    <td className="px-4 md:px-6 py-3.5">
                      <span className={clsx(
                        'px-2 py-0.5 rounded-full text-xs font-medium',
                        ev.ended_at ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                      )}>
                        {ev.ended_at ? 'Completat' : 'Actiu'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
