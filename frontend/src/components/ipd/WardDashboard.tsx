import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { ArrowLeft, Sparkles, UserPlus } from 'lucide-react'
import { Button, Card, PageHeader, Alert } from '../ui'
import { PatientSearchAutocomplete, type PatientSearchItem } from '../PatientSearchAutocomplete'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'
import {
  bedCardStyles,
  ipdStatusLabels,
  ipdStatusStyles,
  type IpdClinicalStatus,
  calcLosDays,
} from './ipd-utils'

type CensusRow = {
  bed: { id: string; bedNo: string; status: string }
  admission: { id: string; admissionNo: string; admittedAt: string; reason: string } | null
  patient: {
    id: string
    firstName: string
    lastName: string
    patientNo: string
    dateOfBirth: string
    gender: string
  } | null
  clinicalStatus: IpdClinicalStatus
  consultant: string
}

function WardMetric({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className={clsx('rounded-2xl border p-5 shadow-sm', tone ?? 'border-slate-200 bg-white')}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{value}</p>
    </div>
  )
}

export function WardDashboard({
  wardId,
  onBack,
  onOpenPatient,
  onAdmit,
}: {
  wardId: string
  onBack: () => void
  onOpenPatient: (admissionId: string) => void
  onAdmit?: (bedId: string) => void
}) {
  const [searchPatient, setSearchPatient] = useState<PatientSearchItem | null>(null)
  const queryClient = useQueryClient()

  const markAvailable = useMutation({
    mutationFn: (bedId: string) =>
      apiRequest(`/inpatient/beds/${bedId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'available' }),
      }),
    onSuccess: async () => {
      notify('Bed ready', 'Housekeeping complete. Bed is available for admission.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['ward-census', wardId] })
      await queryClient.invalidateQueries({ queryKey: ['available-beds'] })
      await queryClient.invalidateQueries({ queryKey: ['ipd-dashboard'] })
    },
    onError: (error: Error) => notify('Cannot free bed', error.message, 'critical'),
  })

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['ward-census', wardId],
    queryFn: () =>
      apiRequest<{
        ward: { id: string; name: string; type: string }
        capacity: number
        occupied: number
        available: number
        reserved?: number
        cleaning?: number
        maintenance?: number
        inactive?: number
        physicalBeds?: number
        configuredCapacity?: number
        census: CensusRow[]
      }>(`/inpatient/wards/${wardId}/census`),
    refetchInterval: 20_000,
  })

  const filteredCensus = useMemo(() => {
    if (!data?.census) return []
    if (!searchPatient) return data.census
    return data.census.filter((row) => row.patient?.id === searchPatient.id)
  }, [data?.census, searchPatient])

  const occupancyPct = data
    ? Math.round((data.occupied / Math.max(data.physicalBeds ?? data.capacity, 1)) * 100)
    : 0
  const avgLos = useMemo(() => {
    const occupied = (data?.census ?? []).filter((r) => r.admission)
    if (!occupied.length) return 0
    const total = occupied.reduce((sum, r) => sum + calcLosDays(r.admission!.admittedAt), 0)
    return Math.round(total / occupied.length)
  }, [data?.census])

  if (isError) {
    return (
      <Card className="space-y-4 p-8">
        <Alert tone="error">{error instanceof Error ? error.message : 'Unable to load this ward.'}</Alert>
        <Button type="button" variant="secondary" onClick={() => refetch()}>
          Retry
        </Button>
      </Card>
    )
  }

  if (isLoading || !data) {
    return (
      <Card className="p-10">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-skeleton rounded-2xl" />
          ))}
        </div>
      </Card>
    )
  }

  const reserved = data.reserved ?? data.census.filter((r) => r.bed.status === 'reserved').length
  const cleaning = data.cleaning ?? data.census.filter((r) => r.bed.status === 'cleaning').length

  return (
    <div className="workspace-shell animate-fade-in pb-10">
      <Button variant="ghost" onClick={onBack} className="touch-target">
        <ArrowLeft className="h-4 w-4" /> All wards
      </Button>

      <PageHeader
        title={data.ward.name}
        description="Visual ward board — tap a bed to open the patient workspace."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <WardMetric label="Physical beds" value={data.physicalBeds ?? data.capacity} />
        <WardMetric label="Occupied" value={data.occupied} tone="border-red-200 bg-red-50/50" />
        <WardMetric label="Available" value={data.available} tone="border-emerald-200 bg-emerald-50/50" />
        <WardMetric label="Reserved" value={reserved} tone="border-sky-200 bg-sky-50/50" />
        <WardMetric label="Cleaning" value={cleaning} tone="border-violet-200 bg-violet-50/50" />
        <WardMetric label="Occupancy" value={`${occupancyPct}%`} />
        <WardMetric label="Avg stay" value={`${avgLos}d`} />
      </div>
      {data.configuredCapacity !== undefined &&
      data.physicalBeds !== undefined &&
      data.configuredCapacity !== data.physicalBeds ? (
        <p className="text-sm text-amber-800">
          Configured capacity: {data.configuredCapacity} · Physical bed records: {data.physicalBeds}
        </p>
      ) : null}

      <Card className="p-5 md:p-6">
        <p className="mb-3 text-sm font-semibold text-slate-700">Find patient on this ward</p>
        <PatientSearchAutocomplete selected={searchPatient} onSelect={setSearchPatient} />
      </Card>

      <section className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Bed board</h3>
        {data.census.length ? (
        <div className="bed-card-grid">
          {filteredCensus.map((row, index) => {
            const isOccupied = Boolean(row.admission && row.patient)
            const bedStyle = bedCardStyles[row.bed.status] ?? bedCardStyles.available
            const clinicalStyle = isOccupied ? ipdStatusStyles[row.clinicalStatus] : ''

            return (
              <article
                key={row.bed.id}
                style={{ animationDelay: `${index * 60}ms` }}
                className={clsx(
                  'bed-card-enter card-hover flex min-h-[11rem] flex-col rounded-2xl border-2 p-5 shadow-sm transition hover:-translate-y-0.5',
                  bedStyle,
                  isOccupied ? 'bed-card-occupied' : row.bed.status === 'available' ? 'bed-card-available' : '',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-bold tracking-tight">BED {row.bed.bedNo}</p>
                    <p className="text-xs font-bold uppercase text-slate-500">{row.bed.status}</p>
                  </div>
                  {isOccupied ? (
                    <span className={clsx('rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase', clinicalStyle)}>
                      {ipdStatusLabels[row.clinicalStatus]}
                    </span>
                  ) : null}
                </div>

                {isOccupied ? (
                  <button
                    type="button"
                    onClick={() => row.admission && onOpenPatient(row.admission.id)}
                    className="mt-4 flex flex-1 flex-col text-left"
                  >
                    <p className="text-base font-bold text-slate-900">
                      {row.patient!.firstName} {row.patient!.lastName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{row.patient!.patientNo}</p>
                    <p className="mt-3 text-sm text-slate-700 line-clamp-2">{row.admission!.reason}</p>
                    <div className="mt-auto pt-4 text-xs text-slate-500">
                      <p>Consultant: {row.consultant}</p>
                      <p>LOS: {calcLosDays(row.admission!.admittedAt)} days</p>
                    </div>
                  </button>
                ) : (
                  <div className="mt-4 flex flex-1 flex-col justify-between">
                    {row.bed.status === 'available' ? (
                      <p className="text-sm font-semibold text-emerald-800">Available</p>
                    ) : null}
                    {row.bed.status === 'reserved' ? (
                      <p className="text-xs text-sky-700">Reserved — expected transfer</p>
                    ) : null}
                    {row.bed.status === 'cleaning' ? (
                      <div>
                        <p className="text-xs text-violet-700">Cleaning in progress — not available for admission</p>
                        <Button
                          type="button"
                          variant="secondary"
                          className="mt-4 w-full"
                          loading={markAvailable.isPending && markAvailable.variables === row.bed.id}
                          onClick={() => markAvailable.mutate(row.bed.id)}
                        >
                          <Sparkles className="h-4 w-4" />
                          Mark available
                        </Button>
                      </div>
                    ) : null}
                    {row.bed.status === 'available' && onAdmit ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="mt-4 w-full"
                        onClick={() => onAdmit(row.bed.id)}
                      >
                        <UserPlus className="h-4 w-4" />
                        Admit patient
                      </Button>
                    ) : null}
                  </div>
                )}
              </article>
            )
          })}
        </div>
        ) : (
          <p className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
            No beds configured for this ward.
          </p>
        )}
      </section>
    </div>
  )
}
