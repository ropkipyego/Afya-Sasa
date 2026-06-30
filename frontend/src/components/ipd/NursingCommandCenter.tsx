import { useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Activity, ArrowLeft, ClipboardList, Pill, Stethoscope } from 'lucide-react'
import { Button, Card, PageHeader } from '../ui'
import { apiRequest } from '../../lib/api'
import { calcLosDays, ipdStatusLabels, ipdStatusStyles } from './ipd-utils'

type ActiveAdmission = {
  id: string
  admissionNo: string
  admittedAt: string
  reason: string
  patient: { id: string; firstName: string; lastName: string; patientNo: string }
  bed: { bedNo: string }
  ward: { id: string; name: string }
}

export function NursingCommandCenter({
  onBack,
  onOpenPatient,
}: {
  onBack: () => void
  onOpenPatient: (admissionId: string) => void
}) {
  const { data: admissions = [] } = useQuery({
    queryKey: ['nursing-admissions'],
    queryFn: () =>
      apiRequest<ActiveAdmission[]>('/inpatient/admissions?status=active'),
    refetchInterval: 30_000,
  })

  const { data: dashboard } = useQuery({
    queryKey: ['ipd-dashboard'],
    queryFn: () =>
      apiRequest<{ patientsDueForReview: number; pendingLabResults: number }>(
        '/inpatient/dashboard',
      ),
  })

  const dueReview = useMemo(
    () => admissions.filter((a) => calcLosDays(a.admittedAt) >= 1),
    [admissions],
  )

  const newAdmissions = useMemo(
    () => admissions.filter((a) => calcLosDays(a.admittedAt) <= 1),
    [admissions],
  )

  return (
    <div className="space-y-12 animate-fade-in pb-10">
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Button>

      <PageHeader
        eyebrow="Nursing"
        title="Nursing command center"
        description="Shift overview — medications, vitals, handover, and escalations."
      />

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Pill className="h-5 w-5" />} label="Active patients" value={admissions.length} />
        <StatCard icon={<Activity className="h-5 w-5" />} label="Due for review" value={dashboard?.patientsDueForReview ?? dueReview.length} />
        <StatCard icon={<Stethoscope className="h-5 w-5" />} label="New admissions" value={newAdmissions.length} />
        <StatCard icon={<ClipboardList className="h-5 w-5" />} label="Pending labs" value={dashboard?.pendingLabResults ?? 0} />
      </section>

      <section className="space-y-8">
        <PatientQueue
          title="Patients due review"
          description="No doctor progress note today — escalate for ward round."
          admissions={dueReview}
          status="review_due"
          onOpen={onOpenPatient}
        />
        <PatientQueue
          title="New admissions"
          description="Admitted within 24 hours — initial nursing assessment due."
          admissions={newAdmissions}
          status="stable"
          onOpen={onOpenPatient}
        />
        <PatientQueue
          title="All inpatients"
          description="Open patient workspace for vitals, MAR, and nursing notes."
          admissions={admissions}
          status="stable"
          onOpen={onOpenPatient}
        />
        <Card className="p-8">
          <h3 className="text-xl font-bold text-slate-900">Shift handover</h3>
          <p className="mt-2 text-sm text-slate-500">
            Capture patient status, pending tasks, escalations, and special instructions per shift.
          </p>
          <div className="mt-6 space-y-4">
            {(['morning', 'afternoon', 'night'] as const).map((shift) => (
              <div key={shift} className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{shift} shift</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Use patient workspace → Nursing Notes to document handover per patient.
                </p>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: number
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="rounded-xl bg-teal-50 p-3 text-teal-700">{icon}</div>
      <div>
        <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
        <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  )
}

function PatientQueue({
  title,
  description,
  admissions,
  status,
  onOpen,
}: {
  title: string
  description: string
  admissions: ActiveAdmission[]
  status: 'stable' | 'review_due' | 'critical'
  onOpen: (id: string) => void
}) {
  return (
    <Card className="p-8">
      <h3 className="text-xl font-bold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
      <ul className="mt-6 space-y-3">
        {admissions.length === 0 ? (
          <li className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
            No patients in this queue.
          </li>
        ) : (
          admissions.map((admission) => (
            <li key={admission.id}>
              <button
                type="button"
                onClick={() => onOpen(admission.id)}
                className="flex w-full flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-teal-300 hover:shadow-sm"
              >
                <div>
                  <p className="text-lg font-semibold text-slate-900">
                    {admission.patient.firstName} {admission.patient.lastName}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {admission.ward.name} · Bed {admission.bed.bedNo} · Day {calcLosDays(admission.admittedAt)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400 line-clamp-1">{admission.reason}</p>
                </div>
                <span
                  className={clsx(
                    'rounded-full border px-3 py-1 text-[11px] font-bold uppercase',
                    ipdStatusStyles[status],
                  )}
                >
                  {ipdStatusLabels[status]}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </Card>
  )
}
