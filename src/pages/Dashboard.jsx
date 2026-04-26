import { useState } from 'react'
import { Droplets, Thermometer, Sun, Play, Square, Clock, WifiOff, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import httpClient from '../api/httpClient'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function StatCard({ icon: Icon, iconBg, value, unit, label, isLoading }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
      <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center mb-4', iconBg)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="text-2xl font-bold text-gray-900 tabular-nums">
        {isLoading
          ? <span className="text-gray-200">—</span>
          : <>{value ?? '—'}<span className="text-sm font-normal text-gray-400 ml-1">{unit}</span></>
        }
      </div>
      <div className="text-sm text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

function HumidityBar({ value }) {
  const color = value == null ? 'bg-gray-200'
    : value < 30 ? 'bg-red-400'
    : value < 60 ? 'bg-yellow-400'
    : 'bg-green-400'

  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-gray-500 mb-1.5">
        <span>Humitat terra</span>
        <span className="font-medium">{value != null ? `${value.toFixed(1)}%` : '—'}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-700', color)}
          style={{ width: value != null ? `${Math.min(value, 100)}%` : '0%' }}
        />
      </div>
    </div>
  )
}

function WaterModal({ zoneId, zoneName, onClose, onConfirm, loading }) {
  const [seconds, setSeconds] = useState(60)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-80">
        <h3 className="font-semibold text-gray-900 mb-1">Regar {zoneName || `Zona ${zoneId}`}</h3>
        <p className="text-sm text-gray-500 mb-5">Quants segons ha de funcionar la bomba?</p>
        <div className="flex items-center gap-3 mb-2">
          <input
            type="range"
            min={5} max={300} step={5}
            value={seconds}
            onChange={e => setSeconds(Number(e.target.value))}
            className="flex-1 accent-green-500"
          />
          <span className="w-16 text-right font-semibold text-gray-800 tabular-nums">
            {seconds} s
          </span>
        </div>
        <p className="text-xs text-gray-400 mb-5">
          {seconds < 60 ? `${seconds} s` : `${(seconds / 60).toFixed(1).replace('.0', '')} min`}
          {' '}· màxim 5 min
        </p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel·lar
          </button>
          <button
            onClick={() => onConfirm(seconds)}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-medium transition-colors disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Iniciar
          </button>
        </div>
      </div>
    </div>
  )
}

function ZoneCard({ zone, isLoading }) {
  const [showModal, setShowModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState(null)

  const isWatering = zone?.is_watering ?? false
  const humidity = zone?.soil_humidity_avg ?? null
  const lastWatered = zone?.last_watered_at ? new Date(zone.last_watered_at) : null

  async function handleWater(durationSeconds) {
    setActionLoading(true)
    setError(null)
    try {
      await httpClient.post(`/api/zones/${zone.id}/water`, { duration_seconds: durationSeconds })
      setShowModal(false)
    } catch (e) {
      setError(e.response?.data?.detail ?? 'Error desconegut')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleStop() {
    setActionLoading(true)
    setError(null)
    try {
      await httpClient.post(`/api/zones/${zone.id}/stop`)
    } catch (e) {
      setError(e.response?.data?.detail ?? 'Error desconegut')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <>
      {showModal && (
        <WaterModal
          zoneId={zone.id}
          zoneName={zone?.name}
          loading={actionLoading}
          onClose={() => setShowModal(false)}
          onConfirm={handleWater}
        />
      )}

      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h3 className="font-semibold text-gray-900">{zone?.name || `Zona ${zone?.id ?? '—'}`}</h3>
            <span className={clsx(
              'inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full mt-1.5',
              isWatering ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
            )}>
              <span className={clsx(
                'w-1.5 h-1.5 rounded-full',
                isWatering ? 'bg-blue-500 animate-pulse' : 'bg-gray-400'
              )} />
              {isWatering ? 'Regant…' : 'En espera'}
            </span>
          </div>

          <div className="flex gap-2">
            {isWatering && (
              <button
                onClick={handleStop}
                disabled={actionLoading || isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-100 hover:bg-red-200 text-red-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
                Aturar
              </button>
            )}
            <button
              onClick={() => setShowModal(true)}
              disabled={isLoading || isWatering || actionLoading}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                isLoading || isWatering || actionLoading
                  ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600 text-white shadow-sm'
              )}
            >
              <Play className="w-3.5 h-3.5" />
              Regar ara
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-1.5">{error}</p>
        )}

        <HumidityBar value={humidity} />

        {lastWatered && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-3">
            <Clock className="w-3.5 h-3.5" />
            <span>Últim reg: {lastWatered.toLocaleString('ca')}</span>
          </div>
        )}
      </div>
    </>
  )
}

export default function Dashboard({ data }) {
  const isLoading = !data
  const ambient = data?.ambient
  const zones = data?.zones ?? [{ id: 1 }, { id: 2 }]

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
          Lectures de sensors
        </h2>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard icon={Droplets} iconBg="bg-blue-500"
            value={zones[0]?.soil_humidity_avg?.toFixed(1)} unit="%" label={`Humitat ${zones[0]?.name || 'Zona 1'}`} isLoading={isLoading} />
          <StatCard icon={Droplets} iconBg="bg-cyan-500"
            value={zones[1]?.soil_humidity_avg?.toFixed(1)} unit="%" label={`Humitat ${zones[1]?.name || 'Zona 2'}`} isLoading={isLoading} />
          <StatCard icon={Thermometer} iconBg="bg-orange-400"
            value={ambient?.temp?.toFixed(1)} unit="°C" label="Temperatura" isLoading={isLoading} />
          <StatCard icon={Sun} iconBg="bg-yellow-400"
            value={ambient?.light_lux != null ? Math.round(ambient.light_lux / 65535 * 100) : null} unit="%" label="Llum ambient" isLoading={isLoading} />
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
          Zones de reg
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {zones.map(zone => (
            <ZoneCard key={zone.id} zone={zone} isLoading={isLoading} />
          ))}
        </div>
      </section>

      {isLoading && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <WifiOff className="w-8 h-8 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-400">Esperant connexió WebSocket</p>
          <p className="text-xs text-gray-300 mt-1">{import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/status'}</p>
        </div>
      )}
    </div>
  )
}
