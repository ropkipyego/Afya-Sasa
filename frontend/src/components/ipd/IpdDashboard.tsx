import { type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, ArrowRight, BedDouble, ClipboardList, Settings, Stethoscope } from 'lucide-react'
import { Button, Card, PageHeader } from '../ui'
import { apiRequest } from '../../lib/api'
import { wardTypeLabel } from './ipd-utils'

type DashboardData = {
  admissionsToday: number
  dischargesToday: number
  transfersToday: number
  occupiedBeds: number
  availableBeds: number
  totalBeds: number
  icuOccupancyPct: number
  hduOccupancyPct: number
  pendingLabResults: number
  pendingRadiologyReports: number
  patientsDueForReview: number
  activeAdmissions: number
  wardSummaries: {
    id: string
    name: string
    type: string
    capacity: number
    occupied: number
    available: number
    criticalPatients: number
    dueForReview: number
  }[]
}

function MetricTile({
  label,
  value,
  suffix,
  tone = 'border-slate-200 bg-white',
}: {
  label: string
  value: number | string
  suffix?: string
  tone?: string
}) {
  return (
    <div className={`rounded-2xl border p-6 shadow-sm ${tone}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold tabular-nums text-slate-900">
        {value}
        {suffix ? <span className="text-lg font-semibold text-slate-500">{suffix}</span> : null}
      </p>
    </div>
  )
}

function MetricSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-5">
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  )
}

export function IpdDashboard({
  onSelectWard,
  onNursing,
  onConsultant,
  onSetup,
  onAdmit,
  wardTypeFilter,
}: {
  onSelectWard: (wardId: string) => void
  onNursing: () => void
  onConsultant: () => void
  onSetup: () => void
  onAdmit: () => void
  wardTypeFilter?: 'icu' | 'hdu'
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['ipd-dashboard'],
    queryFn: () => apiRequest<DashboardData>('/inpatient/dashboard'),
    refetchInterval: 30_000,
  })

  if (isLoading || !data) {
    return (
      <Card>
        <p className="py-20 text-center text-slate-500">Loading inpatient census…</p>
      </Card>
    )
  }

  const wardSummaries = wardTypeFilter
    ? data.wardSummaries.filter((w) => w.type === wardTypeFilter)
    : data.wardSummaries

  const title = wardTypeFilter === 'icu' ? 'ICU ward board' : wardTypeFilter === 'hdu' ? 'HDU ward board' : 'Inpatient dashboard'
  const description = wardTypeFilter
    ? 'Critical care census — visual bed board and patient workspace.'
    : 'Hospital census — one view of beds, wards, and patients.'

  return (
    <div className="workspace-shell animate-fade-in space-y-10 pb-10">
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-900 via-teal-950 to-slate-800 p-8 text-white shadow-lg">
        <PageHeader
          eyebrow="Inpatient"
          title={title}
          description={description}
          actions={
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={onConsultant}>
                <Stethoscope className="h-4 w-4" /> Ward rounds
              </Button>
              <Button variant="secondary" onClick={onNursing}>
                <Stethoscope className="h-4 w-4" /> Nursing center
              </Button>
              <Button variant="secondary" onClick={onSetup}>
                <Settings className="h-4 w-4" /> Ward setup
              </Button>
              <Button onClick={onAdmit}>
                <BedDouble className="h-4 w-4" /> Admit patient
              </Button>
            </div>
          }
        />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur">
            <p className="text-[10px] font-bold uppercase text-teal-100">Active inpatients</p>
            <p className="mt-1 text-3xl font-bold">{data.activeAdmissions}</p>
          </div>
          <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur">
            <p className="text-[10px] font-bold uppercase text-teal-100">Bed occupancy</p>
            <p className="mt-1 text-3xl font-bold">
              {data.totalBeds
                ? Math.round((data.occupiedBeds / data.totalBeds) * 100)
                : 0}
              <span className="text-lg">%</span>
            </p>
          </div>
          <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur">
            <p className="text-[10px] font-bold uppercase text-teal-100">Admissions today</p>
            <p className="mt-1 text-3xl font-bold">{data.admissionsToday}</p>
          </div>
          <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur">
            <p className="text-[10px] font-bold uppercase text-teal-100">Pending investigations</p>
            <p className="mt-1 text-3xl font-bold">
              {data.pendingLabResults + data.pendingRadiologyReports}
            </p>
          </div>
        </div>
      </Card>

      <MetricSection title="Today's flow">
        <MetricTile label="Admissions today" value={data.admissionsToday} tone="border-sky-200 bg-sky-50" />
        <MetricTile label="Discharges today" value={data.dischargesToday} tone="border-emerald-200 bg-emerald-50" />
        <MetricTile label="Transfers today" value={data.transfersToday} tone="border-violet-200 bg-violet-50" />
        <MetricTile label="Active inpatients" value={data.activeAdmissions} tone="border-teal-200 bg-teal-50" />
      </MetricSection>

      <MetricSection title="Bed status">
        <MetricTile label="Occupied beds" value={data.occupiedBeds} tone="border-rose-200 bg-rose-50" />
        <MetricTile label="Available beds" value={data.availableBeds} tone="border-emerald-200 bg-emerald-50" />
        <MetricTile label="ICU occupancy" value={data.icuOccupancyPct} suffix="%" tone="border-orange-200 bg-orange-50" />
        <MetricTile label="HDU occupancy" value={data.hduOccupancyPct} suffix="%" tone="border-amber-200 bg-amber-50" />
      </MetricSection>

      <MetricSection title="Clinical workload">
        <MetricTile label="Pending lab" value={data.pendingLabResults} />
        <MetricTile label="Pending radiology" value={data.pendingRadiologyReports} />
        <MetricTile label="Due for review" value={data.patientsDueForReview} />
      </MetricSection>

      <section className="space-y-6">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Ward summary</h3>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {wardSummaries.map((ward) => (
            <button
              key={ward.id}
              type="button"
              onClick={() => onSelectWard(ward.id)}
              className="group rounded-2xl border border-slate-200 bg-white p-8 text-left shadow-sm transition hover:border-teal-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase text-teal-600">
                    {wardTypeLabel(ward.type)}
                  </p>
                  <h4 className="mt-2 text-2xl font-bold text-slate-900">{ward.name}</h4>
                </div>
                <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:text-teal-600" />
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-slate-50 py-3">
                  <p className="text-xs text-slate-500">Capacity</p>
                  <p className="mt-1 text-lg font-bold">{ward.capacity}</p>
                </div>
                <div className="rounded-xl bg-red-50 py-3">
                  <p className="text-xs text-red-600">Occupied</p>
                  <p className="mt-1 text-lg font-bold text-red-800">{ward.occupied}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 py-3">
                  <p className="text-xs text-emerald-600">Available</p>
                  <p className="mt-1 text-lg font-bold text-emerald-800">{ward.available}</p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold text-slate-500">
                <span className="flex items-center gap-2">
                  <Activity className="h-4 w-4" /> {ward.dueForReview} review due
                </span>
                <span className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" /> {ward.criticalPatients} critical
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
