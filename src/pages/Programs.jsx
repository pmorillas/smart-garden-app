import { useState, useEffect, useCallback } from 'react'
import {
  CalendarDays, Plus, Trash2, Pencil, X, Check,
  Loader2, Clock, Droplets, Thermometer, ChevronUp, ChevronDown,
  Layers, GitMerge,
} from 'lucide-react'
import clsx from 'clsx'
import { fetchZones } from '../api/zones'
import { fetchPrograms, createProgram, updateProgram, deleteProgram } from '../api/programs'

// ── Condition types ──────────────────────────────────────────────────────────

const CONDITION_TYPES = [
  { value: 'schedule',      label: 'Horari',           icon: Clock },
  { value: 'soil_humidity', label: 'Humitat terra',    icon: Droplets },
  { value: 'temperature',   label: 'Temperatura',      icon: Thermometer },
  { value: 'time_range',    label: 'Franja horària',   icon: Clock },
]

const DAYS_CA = ['Dl', 'Dt', 'Dc', 'Dj', 'Dv', 'Ds', 'Dg']
const OPERATORS = [
  { value: 'lt', label: '< menor que' },
  { value: 'gt', label: '> major que' },
]

function newCondition(type) {
  switch (type) {
    case 'schedule':      return { type, time: '07:00', days: [1, 2, 3, 4, 5] }
    case 'soil_humidity': return { type, operator: 'lt', value: 40 }
    case 'temperature':   return { type, operator: 'lt', value: 35 }
    case 'time_range':    return { type, from: '06:00', to: '22:00' }
    default:              return { type }
  }
}

function conditionSummary(c) {
  switch (c.type) {
    case 'schedule': {
      const days = (c.days ?? []).map(d => DAYS_CA[d - 1] ?? d).join(', ')
      return `Horari ${c.time ?? ''} els ${days}`
    }
    case 'soil_humidity':
      return `Humitat terra ${c.operator === 'lt' ? '<' : '>'} ${c.value}%`
    case 'temperature':
      return `Temperatura ${c.operator === 'lt' ? '<' : '>'} ${c.value}°C`
    case 'time_range':
      return `Entre les ${c.from} i les ${c.to}`
    default:
      return c.type
  }
}

// ── Condition editor ─────────────────────────────────────────────────────────

function ConditionEditor({ condition, onChange, onRemove }) {
  const set = (key, val) => onChange({ ...condition, [key]: val })

  return (
    <div className="rounded-xl border border-gray-200 p-4 space-y-3 bg-gray-50">
      <div className="flex items-center gap-2">
        <select
          value={condition.type}
          onChange={e => onChange(newCondition(e.target.value))}
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
        >
          {CONDITION_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <button
          onClick={onRemove}
          className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {condition.type === 'schedule' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500 w-16">Hora</label>
            <input
              type="time"
              value={condition.time ?? '07:00'}
              onChange={e => set('time', e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs text-gray-500 w-16">Dies</label>
            <div className="flex gap-1">
              {DAYS_CA.map((d, i) => {
                const dayNum = i + 1
                const active = (condition.days ?? []).includes(dayNum)
                return (
                  <button
                    key={dayNum}
                    type="button"
                    onClick={() => {
                      const days = condition.days ?? []
                      set('days', active ? days.filter(x => x !== dayNum) : [...days, dayNum].sort())
                    }}
                    className={clsx(
                      'w-8 h-8 text-xs font-medium rounded-lg transition-colors',
                      active ? 'bg-green-500 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-green-400'
                    )}
                  >
                    {d}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {(condition.type === 'soil_humidity' || condition.type === 'temperature') && (
        <div className="flex items-center gap-3">
          <select
            value={condition.operator ?? 'lt'}
            onChange={e => set('operator', e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
          >
            {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input
            type="number"
            value={condition.value ?? 0}
            onChange={e => set('value', Number(e.target.value))}
            className="w-20 text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-right"
          />
          <span className="text-sm text-gray-400">
            {condition.type === 'soil_humidity' ? '%' : '°C'}
          </span>
        </div>
      )}

      {condition.type === 'time_range' && (
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-xs text-gray-500">De</label>
          <input
            type="time"
            value={condition.from ?? '06:00'}
            onChange={e => set('from', e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
          />
          <label className="text-xs text-gray-500">a</label>
          <input
            type="time"
            value={condition.to ?? '22:00'}
            onChange={e => set('to', e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
          />
        </div>
      )}
    </div>
  )
}

// ── Zone selector in form ─────────────────────────────────────────────────────

function ZoneSelector({ selectedZones, allZones, executionMode, onChangeZones, onChangeMode }) {
  const toggle = (zoneId) => {
    const exists = selectedZones.find(z => z.zone_id === zoneId)
    if (exists) {
      onChangeZones(selectedZones.filter(z => z.zone_id !== zoneId).map((z, i) => ({ ...z, order_index: i })))
    } else {
      onChangeZones([...selectedZones, { zone_id: zoneId, order_index: selectedZones.length, duration_override_seconds: null }])
    }
  }

  const moveUp = (idx) => {
    if (idx === 0) return
    const arr = [...selectedZones]
    ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
    onChangeZones(arr.map((z, i) => ({ ...z, order_index: i })))
  }

  const moveDown = (idx) => {
    if (idx === selectedZones.length - 1) return
    const arr = [...selectedZones]
    ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
    onChangeZones(arr.map((z, i) => ({ ...z, order_index: i })))
  }

  const setDurationOverride = (idx, val) => {
    const arr = [...selectedZones]
    arr[idx] = { ...arr[idx], duration_override_seconds: val ? Number(val) : null }
    onChangeZones(arr)
  }

  const ordered = [...selectedZones].sort((a, b) => a.order_index - b.order_index)

  return (
    <div className="space-y-3">
      {/* Zone checkboxes */}
      <div className="flex flex-wrap gap-2">
        {allZones.map(z => {
          const selected = !!selectedZones.find(s => s.zone_id === z.id)
          return (
            <button
              key={z.id}
              type="button"
              onClick={() => toggle(z.id)}
              className={clsx(
                'px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors',
                selected
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-green-400'
              )}
            >
              {z.name}
            </button>
          )
        })}
      </div>

      {/* Execution mode (only if 2+ zones) */}
      {selectedZones.length >= 2 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">Execució:</span>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            {[
              { value: 'simultaneous', label: 'Simultàni', Icon: Layers },
              { value: 'sequential',   label: 'Seqüencial', Icon: GitMerge },
            ].map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => onChangeMode(value)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-2 transition-colors',
                  executionMode === value ? 'bg-green-500 text-white' : 'text-gray-500 hover:bg-gray-50'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sequential order + per-zone duration override */}
      {selectedZones.length >= 2 && (
        <div className="space-y-1.5">
          {ordered.map((pz, idx) => {
            const zone = allZones.find(z => z.id === pz.zone_id)
            return (
              <div key={pz.zone_id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                {executionMode === 'sequential' && (
                  <div className="flex flex-col gap-0.5">
                    <button type="button" onClick={() => moveUp(idx)} disabled={idx === 0} className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30">
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => moveDown(idx)} disabled={idx === ordered.length - 1} className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {executionMode === 'sequential' && (
                  <span className="text-xs text-gray-400 w-4 text-center">{idx + 1}</span>
                )}
                <span className="text-sm text-gray-700 flex-1">{zone?.name ?? `Zona ${pz.zone_id}`}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400">Durada:</span>
                  <input
                    type="number"
                    placeholder="defecte"
                    value={pz.duration_override_seconds ?? ''}
                    min={5} max={3600}
                    onChange={e => setDurationOverride(idx, e.target.value)}
                    className="w-20 text-right text-xs px-2 py-1 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                  <span className="text-xs text-gray-400">s</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Program form (slide-over) ─────────────────────────────────────────────────

const BLANK_FORM = {
  name: '',
  active: true,
  execution_mode: 'simultaneous',
  condition_logic: 'AND',
  duration_seconds: 120,
  conditions: [],
  zones: [],
}

function ProgramForm({ allZones, initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial ? {
    ...initial,
    zones: initial.zones ?? [],
  } : { ...BLANK_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const setCondition = (i, c) =>
    setForm(f => ({ ...f, conditions: f.conditions.map((x, j) => j === i ? c : x) }))

  const removeCondition = (i) =>
    setForm(f => ({ ...f, conditions: f.conditions.filter((_, j) => j !== i) }))

  const addCondition = () =>
    setForm(f => ({ ...f, conditions: [...f.conditions, newCondition('schedule')] }))

  async function handleSave() {
    if (!form.name.trim()) { setError('El nom és obligatori'); return }
    if (form.zones.length === 0) { setError('Selecciona almenys una zona'); return }
    if (form.conditions.length === 0) { setError('Afegeix almenys una condició per activar el programa'); return }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: form.name,
        active: form.active,
        execution_mode: form.execution_mode,
        condition_logic: form.condition_logic,
        duration_seconds: form.duration_seconds,
        conditions: form.conditions,
        zones: form.zones,
      }
      if (form.id) {
        await updateProgram(form.id, payload)
      } else {
        await createProgram(payload)
      }
      onSaved()
      onClose()
    } catch {
      setError('Error en desar el programa')
    } finally {
      setSaving(false)
    }
  }

  const durationLabel = form.duration_seconds < 60
    ? `${form.duration_seconds} s`
    : `${Math.round(form.duration_seconds / 60)} min`

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 md:inset-y-0 md:right-0 md:left-auto md:w-[520px] z-50 bg-white md:shadow-2xl flex flex-col max-h-[90vh] md:max-h-full rounded-t-2xl md:rounded-none overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-gray-900">
            {form.id ? 'Editar programa' : 'Nou programa'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom</label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Ex: Reg matinal"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Zones */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Zones</label>
            <ZoneSelector
              selectedZones={form.zones}
              allZones={allZones}
              executionMode={form.execution_mode}
              onChangeZones={z => set('zones', z)}
              onChangeMode={m => set('execution_mode', m)}
            />
          </div>

          {/* Duration */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-700">Durada per defecte</label>
              <span className="text-sm font-semibold text-green-600">{durationLabel}</span>
            </div>
            <input
              type="range"
              min={5} max={600} step={5}
              value={form.duration_seconds}
              onChange={e => set('duration_seconds', Number(e.target.value))}
              className="w-full accent-green-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>5 s</span><span>10 min</span>
            </div>
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">Condicions</label>
              {form.conditions.length > 1 && (
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                  {['AND', 'OR'].map(logic => (
                    <button
                      key={logic}
                      onClick={() => set('condition_logic', logic)}
                      className={clsx(
                        'px-3 py-1.5 transition-colors',
                        form.condition_logic === logic ? 'bg-green-500 text-white' : 'text-gray-500 hover:bg-gray-50'
                      )}
                    >
                      {logic === 'AND' ? 'Totes (I)' : 'Alguna (O)'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              {form.conditions.map((c, i) => (
                <ConditionEditor
                  key={i}
                  condition={c}
                  onChange={c => setCondition(i, c)}
                  onRemove={() => removeCondition(i)}
                />
              ))}
            </div>

            <button
              onClick={addCondition}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-green-400 hover:text-green-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Afegir condició
            </button>

            {form.conditions.length === 0 && (
              <p className="text-xs text-gray-400 text-center mt-2">
                Sense condicions el programa mai s'activarà automàticament
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Actiu</span>
            <button
              type="button"
              onClick={() => set('active', !form.active)}
              className={clsx(
                'relative inline-flex w-10 h-5 rounded-full transition-colors focus:outline-none',
                form.active ? 'bg-green-500' : 'bg-gray-300'
              )}
            >
              <span className={clsx(
                'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                form.active && 'translate-x-5'
              )} />
            </button>
          </div>
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel·lar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors min-w-[100px] justify-center"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {form.id ? 'Actualitzar' : 'Crear'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Program card ──────────────────────────────────────────────────────────────

function ProgramCard({ program, allZones, onEdit, onDelete }) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(`Eliminar "${program.name}"?`)) return
    setDeleting(true)
    try { await deleteProgram(program.id); onDelete() }
    catch { setDeleting(false) }
  }

  const programZones = (program.zones ?? [])
    .sort((a, b) => a.order_index - b.order_index)
    .map(pz => allZones.find(z => z.id === pz.zone_id))
    .filter(Boolean)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-gray-900 truncate">{program.name}</h3>
            <span className={clsx(
              'text-xs px-2 py-0.5 rounded-full font-medium',
              program.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            )}>
              {program.active ? 'Actiu' : 'Inactiu'}
            </span>
            {programZones.length >= 2 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                {program.execution_mode === 'sequential' ? 'Seqüencial' : 'Simultàni'}
              </span>
            )}
          </div>

          {/* Zone chips */}
          {programZones.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {programZones.map(z => (
                <span key={z.id} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {z.name}
                </span>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-400 mt-1">
            Durada: {program.duration_seconds < 60 ? `${program.duration_seconds} s` : `${Math.round(program.duration_seconds / 60)} min`}
            {program.conditions.length > 1 && ` · Lògica: ${program.condition_logic}`}
          </p>

          {program.conditions.length > 0 && (
            <ul className="mt-2 space-y-1">
              {program.conditions.map((c, i) => (
                <li key={i} className="text-xs text-gray-500 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-green-400 flex-shrink-0" />
                  {conditionSummary(c)}
                </li>
              ))}
            </ul>
          )}
          {program.conditions.length === 0 && (
            <p className="text-xs text-gray-300 mt-2">Sense condicions</p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onEdit(program)}
            className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Programs() {
  const [zones, setZones] = useState([])
  const [programs, setPrograms] = useState([])
  const [filterZone, setFilterZone] = useState(null)
  const [loading, setLoading] = useState(true)
  const [formState, setFormState] = useState(null)

  const load = useCallback(async () => {
    try {
      const [z, p] = await Promise.all([fetchZones(), fetchPrograms()])
      setZones(z)
      setPrograms(p)
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, []) // eslint-disable-line

  const filtered = filterZone
    ? programs.filter(p => (p.zones ?? []).some(pz => pz.zone_id === filterZone))
    : programs

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-green-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Programs list */}
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-semibold text-gray-900">Programes de reg</h2>
            <p className="text-xs text-gray-400 mt-0.5">{programs.length} programa{programs.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Zone filter */}
            {zones.length > 1 && (
              <select
                value={filterZone ?? ''}
                onChange={e => setFilterZone(e.target.value ? Number(e.target.value) : null)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              >
                <option value="">Totes les zones</option>
                {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            )}
            <button
              onClick={() => setFormState({ initial: null })}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nou programa</span>
              <span className="sm:hidden">Nou</span>
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {filtered.length === 0 ? (
            <div className="py-10 text-center">
              <CalendarDays className="w-8 h-8 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-400">Cap programa configurat</p>
              <p className="text-xs text-gray-300 mt-1">Crea un programa per automatitzar el reg</p>
            </div>
          ) : (
            filtered.map(p => (
              <ProgramCard
                key={p.id}
                program={p}
                allZones={zones}
                onEdit={prog => setFormState({ initial: prog })}
                onDelete={load}
              />
            ))
          )}
        </div>
      </div>

      {formState !== null && (
        <ProgramForm
          allZones={zones}
          initial={formState.initial}
          onClose={() => setFormState(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}
