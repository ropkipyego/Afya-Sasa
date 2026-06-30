import clsx from 'clsx'
import { Clock, User } from 'lucide-react'
import { Button } from '../ui'

export type VitalRow = {
  id: string
  recordedAt: string
  createdBy?: string | null
  recordedByName?: string
  temperature?: string | number | null
  pulse?: number | null
  respiratoryRate?: number | null
  bpSystolic?: number | null
  bpDiastolic?: number | null
  spo2?: number | null
  bloodGlucose?: string | number | null
}

function formatWhen(iso: string) {
  const date = new Date(iso)
  return {
    date: date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
    time: date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    relative: formatRelative(date),
  }
}

function formatRelative(date: Date) {
  const mins = Math.round((Date.now() - date.getTime()) / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function vitalTone(label: string, value: number | string | null | undefined): string {
  const num = Number(value)
  if (Number.isNaN(num)) return 'border-slate-200 bg-white'
  if (label === 'Blood Pressure' && num >= 140) return 'border-red-200 bg-red-50/60'
  if (label === 'Pulse' && (num > 100 || num < 60)) return 'border-amber-200 bg-amber-50/60'
  if (label === 'Temperature' && num > 37.5) return 'border-orange-200 bg-orange-50/60'
  if (label === 'SpO₂' && num < 95) return 'border-red-200 bg-red-50/60'
  if (label === 'Respiratory Rate' && num > 20) return 'border-amber-200 bg-amber-50/60'
  return 'border-emerald-200 bg-emerald-50/40'
}

export function VitalsTrendPanel({
  vitals,
  onRecord,
}: {
  vitals: VitalRow[]
  onRecord?: () => void
}) {
  if (!vitals.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-8 py-16 text-center">
        <p className="text-lg font-semibold text-slate-700">No vitals recorded yet</p>
        <p className="mt-2 text-sm text-slate-500">
          Record the first set of vitals for this admission.
        </p>
        {onRecord ? (
          <Button className="mt-6" onClick={onRecord}>
            Record vitals
          </Button>
        ) : null}
      </div>
    )
  }

  const latest = vitals[0]
  const when = formatWhen(latest.recordedAt)
  const metrics = [
    {
      label: 'Blood Pressure',
      value: latest.bpSystolic ? `${latest.bpSystolic}/${latest.bpDiastolic ?? '—'} mmHg` : '—',
      raw: latest.bpSystolic,
    },
    { label: 'Pulse', value: latest.pulse ? `${latest.pulse} bpm` : '—', raw: latest.pulse },
    {
      label: 'Temperature',
      value: latest.temperature ? `${latest.temperature}°C` : '—',
      raw: latest.temperature,
    },
    { label: 'SpO₂', value: latest.spo2 ? `${latest.spo2}%` : '—', raw: latest.spo2 },
    {
      label: 'Respiratory Rate',
      value: latest.respiratoryRate ? `${latest.respiratoryRate} /min` : '—',
      raw: latest.respiratoryRate,
    },
    {
      label: 'Blood Sugar',
      value: latest.bloodGlucose ? `${latest.bloodGlucose} mmol/L` : '—',
      raw: latest.bloodGlucose,
    },
  ]

  return (
    <div className="space-y-10">
      <div className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-teal-700">
              Latest vitals
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{when.relative}</p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-sm">
                <Clock className="h-4 w-4 text-teal-600" />
                {when.date} at {when.time}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-sm">
                <User className="h-4 w-4 text-teal-600" />
                Recorded by {latest.recordedByName ?? 'Unknown'}
              </span>
            </div>
          </div>
          {onRecord ? (
            <Button variant="secondary" onClick={onRecord}>
              Record new vitals
            </Button>
          ) : null}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className={clsx(
                'rounded-xl border p-5 shadow-sm',
                vitalTone(metric.label, metric.raw ?? null),
              )}
            >
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {metric.label}
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{metric.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">
          Vitals history
        </h4>
        <ul className="space-y-3">
          {vitals.map((row, index) => {
            const rowWhen = formatWhen(row.recordedAt)
            return (
              <li
                key={row.id}
                className={clsx(
                  'rounded-xl border border-slate-200 bg-white p-5 shadow-sm',
                  index === 0 && 'ring-2 ring-teal-100',
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {rowWhen.date} · {rowWhen.time}
                    </p>
                    <p className="text-sm text-slate-500">{rowWhen.relative}</p>
                  </div>
                  <p className="text-sm text-slate-600">
                    By <span className="font-semibold">{row.recordedByName ?? 'Unknown'}</span>
                  </p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <VitalChip label="BP" value={`${row.bpSystolic ?? '—'}/${row.bpDiastolic ?? '—'}`} />
                  <VitalChip label="Pulse" value={row.pulse ?? '—'} />
                  <VitalChip label="Temp" value={row.temperature ? `${row.temperature}°C` : '—'} />
                  <VitalChip label="SpO₂" value={row.spo2 ? `${row.spo2}%` : '—'} />
                  <VitalChip label="RR" value={row.respiratoryRate ?? '—'} />
                  <VitalChip label="Glucose" value={row.bloodGlucose ?? '—'} />
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function VitalChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-slate-50 px-4 py-3">
      <p className="text-[10px] font-bold uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  )
}
