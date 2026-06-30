import { useState } from 'react'
import clsx from 'clsx'
import { AlertTriangle } from 'lucide-react'
import { getClinicalVitalLabel } from '../lib/vital-clinical-labels'
import type { VitalAssessment } from '../lib/vital-types'
import { Input } from './ui'

type VitalConfig = {
  name: string
  label: string
  unit: string
  presets: { label: string; value: number }[]
  normalMin: number
  normalMax: number
  criticalLow?: number
  criticalHigh?: number
}

const vitalConfigs: VitalConfig[] = [
  {
    name: 'temperature',
    label: 'Temperature',
    unit: '°C',
    presets: [
      { label: 'Normal (37°C)', value: 37 },
      { label: 'Low (36°C)', value: 36 },
      { label: 'Fever (38°C)', value: 38 },
      { label: 'High fever (39.5°C)', value: 39.5 },
    ],
    normalMin: 36.1,
    normalMax: 37.5,
    criticalLow: 35,
    criticalHigh: 40,
  },
  {
    name: 'pulse',
    label: 'Pulse',
    unit: 'bpm',
    presets: [
      { label: 'Normal (72)', value: 72 },
      { label: 'Slow (55)', value: 55 },
      { label: 'Fast (110)', value: 110 },
      { label: 'Very fast (130)', value: 130 },
    ],
    normalMin: 60,
    normalMax: 100,
    criticalLow: 50,
    criticalHigh: 130,
  },
  {
    name: 'respiratoryRate',
    label: 'Respiratory rate',
    unit: '/min',
    presets: [
      { label: 'Normal (16)', value: 16 },
      { label: 'Slow (10)', value: 10 },
      { label: 'Fast (24)', value: 24 },
    ],
    normalMin: 12,
    normalMax: 20,
    criticalLow: 8,
    criticalHigh: 28,
  },
  {
    name: 'spo2',
    label: 'SpO₂',
    unit: '%',
    presets: [
      { label: 'Normal (98%)', value: 98 },
      { label: 'Borderline (94%)', value: 94 },
      { label: 'Low (90%)', value: 90 },
    ],
    normalMin: 95,
    normalMax: 100,
    criticalLow: 90,
  },
  {
    name: 'bpSystolic',
    label: 'BP systolic',
    unit: 'mmHg',
    presets: [
      { label: 'Normal (120)', value: 120 },
      { label: 'Elevated (140)', value: 140 },
      { label: 'Low (90)', value: 90 },
      { label: 'High (160)', value: 160 },
    ],
    normalMin: 90,
    normalMax: 130,
    criticalLow: 80,
    criticalHigh: 180,
  },
  {
    name: 'bpDiastolic',
    label: 'BP diastolic',
    unit: 'mmHg',
    presets: [
      { label: 'Normal (80)', value: 80 },
      { label: 'Elevated (90)', value: 90 },
      { label: 'Low (60)', value: 60 },
    ],
    normalMin: 60,
    normalMax: 85,
    criticalLow: 50,
    criticalHigh: 110,
  },
]

function assessVital(config: VitalConfig, value: number): VitalAssessment {
  if (
    (config.criticalLow !== undefined && value <= config.criticalLow) ||
    (config.criticalHigh !== undefined && value >= config.criticalHigh)
  ) {
    return 'critical'
  }
  if (value < config.normalMin) return 'low'
  if (value > config.normalMax) return 'high'
  return 'normal'
}

const assessmentStyles: Record<VitalAssessment, string> = {
  normal: 'border-emerald-200 bg-emerald-50/80 text-emerald-900',
  low: 'border-amber-300 bg-amber-50 text-amber-950',
  high: 'border-orange-300 bg-orange-50 text-orange-950',
  critical: 'border-red-400 bg-red-50 text-red-900',
}

const assessmentBadgeStyles: Record<VitalAssessment, string> = {
  normal: 'text-emerald-700',
  low: 'text-amber-800',
  high: 'text-orange-800',
  critical: 'text-red-800',
}

function VitalPicker({ config }: { config: VitalConfig }) {
  const [value, setValue] = useState(String(config.presets[0].value))
  const numeric = Number(value) || 0
  const assessment = assessVital(config, numeric)
  const clinicalLabel = getClinicalVitalLabel(config.name, numeric, assessment)

  return (
    <div
      className={clsx(
        'rounded-xl border p-3 transition-colors duration-200',
        assessmentStyles[assessment],
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{config.label}</p>
          <p className="text-[10px] text-slate-500">
            Normal: {config.normalMin}–{config.normalMax} {config.unit}
          </p>
        </div>
        {assessment !== 'normal' ? (
          <span
            className={clsx(
              'inline-flex items-center gap-1 text-[10px] font-bold uppercase',
              assessmentBadgeStyles[assessment],
            )}
          >
            <AlertTriangle className="h-3 w-3" />
            {clinicalLabel ?? (assessment === 'critical' ? 'Critical' : 'Abnormal')}
          </span>
        ) : (
          <span className="text-[10px] font-bold uppercase text-emerald-700">Normal</span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {config.presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className={clsx(
              'rounded-lg px-2 py-1 text-xs font-medium transition',
              Number(value) === preset.value
                ? 'bg-white shadow-sm ring-1 ring-slate-200'
                : 'bg-white/50 hover:bg-white/80',
            )}
            onClick={() => setValue(String(preset.value))}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <input type="hidden" name={config.name} value={value} />
      <Input
        name={`${config.name}Custom`}
        type="number"
        step="any"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="mt-2"
        aria-label={`Custom ${config.label}`}
      />
    </div>
  )
}

export function VitalsForm() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {vitalConfigs.map((config) => (
        <VitalPicker key={config.name} config={config} />
      ))}
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-600">
          Weight (kg) / Height (cm)
        </span>
        <div className="grid grid-cols-2 gap-2">
          <Input name="weight" type="number" step="0.1" placeholder="Weight" />
          <Input name="height" type="number" step="0.1" placeholder="Height" />
        </div>
      </label>
    </div>
  )
}

export function TriageSummaryPanel({
  triage,
}: {
  triage: {
    colour: string
    category?: string
    chiefComplaint?: string
    painScore?: number | null
    temperature?: string | number | null
    pulse?: number | null
    respiratoryRate?: number | null
    bpSystolic?: number | null
    bpDiastolic?: number | null
    spo2?: number | null
    weight?: string | number | null
    height?: string | number | null
  }
}) {
  const vitals = [
    triage.temperature != null ? `Temp ${triage.temperature}°C` : null,
    triage.pulse != null ? `Pulse ${triage.pulse}` : null,
    triage.respiratoryRate != null ? `RR ${triage.respiratoryRate}` : null,
    triage.bpSystolic != null ? `BP ${triage.bpSystolic}/${triage.bpDiastolic ?? '—'}` : null,
    triage.spo2 != null ? `SpO₂ ${triage.spo2}%` : null,
    triage.weight != null ? `Wt ${triage.weight}kg` : null,
    triage.height != null ? `Ht ${triage.height}cm` : null,
  ].filter(Boolean)

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Triage summary</p>
      <p className="text-sm font-semibold capitalize text-slate-800">
        {triage.category ?? 'General'} · Pain {triage.painScore ?? 0}/10
      </p>
      {triage.chiefComplaint ? (
        <p className="text-sm text-slate-700">
          <span className="font-medium">Chief complaint:</span> {triage.chiefComplaint}
        </p>
      ) : null}
      {vitals.length ? (
        <div className="flex flex-wrap gap-2">
          {vitals.map((item) => (
            <span
              key={item}
              className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
            >
              {item}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export { vitalConfigs, assessVital }
