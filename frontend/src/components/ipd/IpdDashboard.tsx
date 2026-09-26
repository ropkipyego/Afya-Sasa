import { type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, ArrowRight, BedDouble, Settings, Stethoscope } from 'lucide-react'
import { Alert, Button, Card, PageHeader } from '../ui'
import { apiRequest } from '../../lib/api'
import { formatKes } from '../../lib/clinical-catalog'
import { useAuthStore } from '../../lib/auth-store'
import { wardTypeLabel } from './ipd-utils'

type DashboardData = {
  admissionsToday: number
  dischargesToday: number
  transfersToday: number
  occupiedBeds: number
  availableBeds: number
  cleaningBeds?: number
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
    physicalBeds?: number
    configuredCapacity?: number
    criticalPatients: number | null
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
  onOpenPatient,
  wardTypeFilter,
}: {
  onSelectWard: (wardId: string) => void
  onNursing: () => void
  onConsultant: () => void
  onSetup: () => void
  onAdmit: () => void
  onOpenPatient?: (admissionId: string) => void
  wardTypeFilter?: 'icu' | 'hdu'
}) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['ipd-dashboard'],
    queryFn: () => apiRequest<DashboardData>('/inpatient/dashboard'),
    refetchInterval: 30_000,
  })
  const canManageSetup = useAuthStore((state) => {
    const permissions = state.user?.permissions ?? []
    return permissions.includes('wards:manage') || permissions.includes('beds:manage')
  })
  const canReadFinance = useAuthStore((state) => {
    const permissions = state.user?.permissions ?? []
    return (
      permissions.includes('payments:read') ||
      permissions.includes('payments:initiate') ||
      permissions.includes('reports:read')
    )
  })
  const { data: finance } = useQuery({
    queryKey: ['ipd-charge-summary'],
    queryFn: () =>
      apiRequest<{
        charges: number
        collections: number
        outstanding: number
        accommodationCharges: number
      }>('/payments/charges/summary?scope=ipd'),
    enabled: canReadFinance,
    refetchInterval: 60_000,
    retry: false,
  })
  const { data: pendingPharmacy } = useQuery({
    queryKey: ['worklists', 'pharmacy', 'pending'],
    queryFn: () =>
      apiRequest<{ total?: number; items?: unknown[] }>('/worklists/pharmacy/pending'),
    refetchInterval: 30_000,
    retry: false,
  })
  const { data: census = [] } = useQuery({
    queryKey: ['ipd-census'],
    queryFn: () =>
      apiRequest<
        Array<{
          admissionId: string
          patient: string
          patientNo: string
          ward: string
          bed: string
          admittedAt: string
          days: number
          charges: number
          paid: number
          outstanding: number
        }>
      >('/payments/charges/ipd-census'),
    refetchInterval: 60_000,
    retry: false,
  })
  const { data: exceptions } = useQuery({
    queryKey: ['billing-exceptions'],
    queryFn: () =>
      apiRequest<{ count: number; exceptions: Array<{ reason: string; patient?: string; expectedService: string }> }>(
        '/payments/exceptions',
      ),
    enabled: canReadFinance,
    refetchInterval: 60_000,
    retry: false,
  })

  if (isError) {
    return (
      <Card className="space-y-4 p-8">
        <Alert tone="error">{error instanceof Error ? error.message : 'Unable to load the inpatient dashboard.'}</Alert>
        <Button type="button" variant="secondary" onClick={() => refetch()}>
          Retry
        </Button>
      </Card>
    )
  }

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
              {canManageSetup ? (
                <Button variant="secondary" onClick={onSetup}>
                  <Settings className="h-4 w-4" /> Ward setup
                </Button>
              ) : null}
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
        <MetricTile label="Cleaning beds" value={data.cleaningBeds ?? 0} tone="border-violet-200 bg-violet-50" />
        <MetricTile label="ICU occupancy" value={data.icuOccupancyPct} suffix="%" tone="border-orange-200 bg-orange-50" />
        <MetricTile label="HDU occupancy" value={data.hduOccupancyPct} suffix="%" tone="border-amber-200 bg-amber-50" />
      </MetricSection>

      <MetricSection title="Clinical workload">
        <MetricTile label="Pending lab" value={data.pendingLabResults} />
        <MetricTile label="Pending radiology" value={data.pendingRadiologyReports} />
        <MetricTile label="Due for review" value={data.patientsDueForReview} />
        <MetricTile
          label="Pending pharmacy"
          value={pendingPharmacy?.total ?? pendingPharmacy?.items?.length ?? 0}
        />
      </MetricSection>

      {canReadFinance && finance ? (
        <MetricSection title="Financial">
          <MetricTile label="Today's IPD charges" value={formatKes(finance.charges)} />
          <MetricTile label="Accommodation posted" value={formatKes(finance.accommodationCharges)} />
          <MetricTile label="IPD payments today" value={formatKes(finance.collections)} tone="border-emerald-200 bg-emerald-50" />
          <MetricTile label="Outstanding IPD" value={formatKes(finance.outstanding)} tone="border-rose-200 bg-rose-50" />
        </MetricSection>
      ) : null}

      {census.length ? (
        <section className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Inpatients</h3>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Ward</th>
                  <th className="px-4 py-3">Bed</th>
                  <th className="px-4 py-3">Admission</th>
                  <th className="px-4 py-3 text-right">Days</th>
                  <th className="px-4 py-3 text-right">Charges</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {census.map((row) => (
                  <tr key={row.admissionId} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      {onOpenPatient ? (
                        <button type="button" className="font-semibold text-teal-700 hover:underline" onClick={() => onOpenPatient(row.admissionId)}>
                          {row.patient}
                        </button>
                      ) : (
                        row.patient
                      )}
                      <p className="text-xs text-slate-500">{row.patientNo}</p>
                    </td>
                    <td className="px-4 py-3">{row.ward}</td>
                    <td className="px-4 py-3">{row.bed}</td>
                    <td className="px-4 py-3">{new Date(row.admittedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.days}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatKes(row.charges)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatKes(row.paid)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatKes(row.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {exceptions?.exceptions?.length ? (
        <Alert tone="warning">
          {exceptions.count} billing exceptions. Latest: {exceptions.exceptions[0]?.reason}
          {exceptions.exceptions[0]?.patient ? ` · ${exceptions.exceptions[0].patient}` : ''}
        </Alert>
      ) : null}

      <section className="space-y-6">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Ward summary</h3>
        {wardSummaries.length ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {wardSummaries.map((ward) => {
            const physical = ward.physicalBeds ?? ward.capacity
            const configured = ward.configuredCapacity
            return (
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
                  <p className="text-xs text-slate-500">Physical beds</p>
                  <p className="mt-1 text-lg font-bold">{physical}</p>
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
              {configured !== undefined && configured !== physical ? (
                <p className="mt-3 text-xs text-amber-800">
                  Configured capacity: {configured} · Physical bed records: {physical}
                </p>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold text-slate-500">
                <span className="flex items-center gap-2">
                  <Activity className="h-4 w-4" /> {ward.dueForReview} review due
                </span>
              </div>
            </button>
            )
          })}
        </div>
        ) : (
          <p className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
            No wards configured yet.
          </p>
        )}
      </section>
    </div>
  )
}
