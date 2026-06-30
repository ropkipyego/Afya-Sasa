import { useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { ArrowLeft, FlaskConical, Scan, Stethoscope, UserPlus } from 'lucide-react'
import { Button, Card, PageHeader } from '../ui'
import { apiRequest } from '../../lib/api'
import { calcLosDays, ipdStatusLabels, ipdStatusStyles } from './ipd-utils'

type Admission = {
  id: string
  admittedAt: string
  reason: string
  patient: { firstName: string; lastName: string; patientNo: string }
  bed: { bedNo: string }
  ward: { name: string }
}

export function ConsultantRoundDashboard({
  onBack,
  onOpenPatient,
}: {
  onBack: () => void
  onOpenPatient: (admissionId: string) => void
}) {
  const { data: admissions = [] } = useQuery({
    queryKey: ['nursing-admissions'],
    queryFn: () => apiRequest<Admission[]>('/inpatient/admissions?status=active'),
  })

  const { data: dashboard } = useQuery({
    queryKey: ['ipd-dashboard'],
    queryFn: () =>
      apiRequest<{
        patientsDueForReview: number
        pendingLabResults: number
        pendingRadiologyReports: number
        dischargesToday: number
      }>('/inpatient/dashboard'),
  })

  const awaitingReview = useMemo(
    () => admissions.filter((a) => calcLosDays(a.admittedAt) >= 1),
    [admissions],
  )
  const newAdmissions = useMemo(
    () => admissions.filter((a) => calcLosDays(a.admittedAt) <= 1),
    [admissions],
  )

  const hospitalCounts = [
    { title: 'Pending labs (hospital)', icon: <FlaskConical className="h-5 w-5" />, count: dashboard?.pendingLabResults ?? 0 },
    { title: 'Pending radiology (hospital)', icon: <Scan className="h-5 w-5" />, count: dashboard?.pendingRadiologyReports ?? 0 },
    { title: 'Discharges today', icon: <ArrowLeft className="h-5 w-5 rotate-180" />, count: dashboard?.dischargesToday ?? 0 },
  ]

  return (
    <div className="space-y-12 animate-fade-in pb-10">
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Button>

      <PageHeader
        eyebrow="Consultant"
        title="Ward round dashboard"
        description="Patients awaiting review, new admissions, and pending investigations."
      />

      <section className="grid gap-5 sm:grid-cols-3">
        {hospitalCounts.map((item) => (
          <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-teal-700">
              {item.icon}
              <p className="text-sm font-bold text-slate-700">{item.title}</p>
            </div>
            <p className="mt-4 text-4xl font-bold text-slate-900">{item.count}</p>
          </div>
        ))}
      </section>

      <PatientRoundQueue
        title="Patients awaiting review"
        icon={<Stethoscope className="h-5 w-5" />}
        items={awaitingReview}
        status="review_due"
        onOpen={onOpenPatient}
      />
      <PatientRoundQueue
        title="New admissions"
        icon={<UserPlus className="h-5 w-5" />}
        items={newAdmissions}
        status="stable"
        onOpen={onOpenPatient}
      />
    </div>
  )
}

function PatientRoundQueue({
  title,
  icon,
  items,
  status,
  onOpen,
}: {
  title: string
  icon: ReactNode
  items: Admission[]
  status: 'stable' | 'review_due'
  onOpen: (id: string) => void
}) {
  return (
    <Card className="p-8">
      <div className="flex items-center gap-3 text-teal-700">
        {icon}
        <h3 className="text-xl font-bold text-slate-900">{title}</h3>
      </div>
      <ul className="mt-6 space-y-3">
        {items.length === 0 ? (
          <li className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
            None in this queue.
          </li>
        ) : (
          items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpen(item.id)}
                className="flex w-full flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-teal-300 hover:shadow-sm"
              >
                <div>
                  <p className="text-lg font-semibold text-slate-900">
                    {item.patient.firstName} {item.patient.lastName}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.ward.name} · Bed {item.bed.bedNo} · Day {calcLosDays(item.admittedAt)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{item.reason}</p>
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
