import type { ReactNode } from 'react'
import clsx from 'clsx'
import { AlertTriangle, Baby, FlaskConical } from 'lucide-react'
import {
  calcAge,
  formatPatientName,
  primaryIdentifier,
  type PatientLike,
} from '../lib/patient-utils'
import { WorkflowBadge, WorkflowProgress } from './WorkflowBadge'
import type { WorkflowStep } from '../lib/workflow-status'

export function PatientContextHeader({
  patient,
  workflowStep,
  sticky = true,
  showWorkflow = true,
  pregnancyAlert = false,
  criticalLabAlert = false,
  className,
}: {
  patient: PatientLike
  workflowStep?: WorkflowStep
  sticky?: boolean
  showWorkflow?: boolean
  pregnancyAlert?: boolean
  criticalLabAlert?: boolean
  className?: string
}) {
  const allergies = patient.allergies ?? []
  const chronic = patient.chronicConditions ?? []
  const idLine = primaryIdentifier(patient)

  return (
    <div
      className={clsx(
        'rounded-xl border border-slate-200 bg-white shadow-sm',
        sticky && 'sticky top-0 z-10',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-teal-600">
            {patient.patientNo}
          </p>
          <h2 className="text-lg font-bold text-slate-900">{formatPatientName(patient)}</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {calcAge(patient.dateOfBirth)} yrs · {patient.gender ?? '—'}
            {patient.primaryPhone ? ` · ${patient.primaryPhone}` : ''}
            {idLine ? ` · ${idLine}` : ''}
          </p>
        </div>
        {workflowStep && showWorkflow ? (
          <div className="text-right">
            <WorkflowBadge step={workflowStep} />
            <div className="mt-2 hidden lg:block">
              <WorkflowProgress current={workflowStep} />
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 px-4 py-3">
        <SafetyChip
          tone={allergies.length ? 'danger' : 'muted'}
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          label="Allergies"
          value={
            allergies.length
              ? allergies.map((item) => item.allergen).join(', ')
              : 'None recorded'
          }
        />
        <SafetyChip
          tone={chronic.length ? 'warning' : 'muted'}
          label="Chronic"
          value={
            chronic.length
              ? chronic.map((item) => item.name).join(', ')
              : 'None recorded'
          }
        />
        {pregnancyAlert ? (
          <SafetyChip
            tone="warning"
            icon={<Baby className="h-3.5 w-3.5" />}
            label="Pregnancy"
            value="Active pregnancy on file"
          />
        ) : null}
        {criticalLabAlert ? (
          <SafetyChip
            tone="danger"
            icon={<FlaskConical className="h-3.5 w-3.5" />}
            label="Critical lab"
            value="Unreviewed critical result"
          />
        ) : null}
      </div>
    </div>
  )
}

function SafetyChip({
  label,
  value,
  tone,
  icon,
}: {
  label: string
  value: string
  tone: 'danger' | 'warning' | 'muted'
  icon?: ReactNode
}) {
  const styles = {
    danger: 'border-red-200 bg-red-50 text-red-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-950',
    muted: 'border-slate-200 bg-slate-50 text-slate-600',
  }

  return (
    <div className={clsx('min-w-[140px] flex-1 rounded-lg border px-3 py-2', styles[tone])}>
      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  )
}

/** @deprecated Use PatientContextHeader */
export function PatientSafetyBanner({ patient }: { patient: PatientLike }) {
  return <PatientContextHeader patient={patient} sticky={false} showWorkflow={false} className="border-0 shadow-none" />
}
