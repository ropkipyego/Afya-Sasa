import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Users } from 'lucide-react'
import { Button, Card, PageHeader } from '../ui'
import { apiRequest } from '../../lib/api'
import { calcAge } from '../../lib/patient-utils'

type PatientRow = {
  id: string
  patientNo: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: string
  primaryPhone?: string | null
  createdAt: string
}

type AgeBand = { label: string; min?: number; max?: number }

const AGE_BANDS: AgeBand[] = [
  { label: 'All ages' },
  { label: '0–25', min: 0, max: 25 },
  { label: '25–50', min: 25, max: 50 },
  { label: '50–75', min: 50, max: 75 },
  { label: '75+', min: 75 },
]

export function PatientRegistry({ onOpenPatient }: { onOpenPatient?: (patientId: string) => void }) {
  const [query, setQuery] = useState('')
  const [ageBand, setAgeBand] = useState<AgeBand>(AGE_BANDS[0])
  const [page, setPage] = useState(1)

  const params = useMemo(() => {
    const search = new URLSearchParams()
    search.set('page', String(page))
    search.set('pageSize', '25')
    if (query.trim()) search.set('q', query.trim())
    if (ageBand.min !== undefined) search.set('ageMin', String(ageBand.min))
    if (ageBand.max !== undefined) search.set('ageMax', String(ageBand.max))
    return search.toString()
  }, [page, query, ageBand])

  const { data, isLoading } = useQuery({
    queryKey: ['patient-registry', params],
    queryFn: () =>
      apiRequest<{ items: PatientRow[]; meta: { total: number; totalPages: number } }>(
        `/worklists/registration/all-patients?${params}`,
      ),
  })

  const patients = data?.items ?? []
  const meta = data?.meta

  return (
    <div className="workspace-shell animate-fade-in space-y-6">
      <Card className="p-6 md:p-8">
        <PageHeader
          title="Patient registry"
          description="All registered patients — filter by age band and search by name or hospital number."
        />

        <div className="mt-6 flex flex-wrap gap-2">
          {AGE_BANDS.map((band) => (
            <button
              key={band.label}
              type="button"
              onClick={() => {
                setAgeBand(band)
                setPage(1)
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                ageBand.label === band.label
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {band.label}
            </button>
          ))}
        </div>

        <label className="relative mt-5 block max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input w-full pl-10"
            placeholder="Search name or patient number…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
          />
        </label>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 text-sm text-slate-600">
          <Users className="mr-2 inline h-4 w-4" />
          {meta?.total ?? 0} patient{(meta?.total ?? 0) === 1 ? '' : 's'} · {ageBand.label}
        </div>

        {isLoading ? (
          <div className="space-y-2 p-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 animate-skeleton rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {patients.map((patient) => (
              <div
                key={patient.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition hover:bg-slate-50"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {patient.firstName} {patient.lastName}
                  </p>
                  <p className="text-sm text-slate-500">
                    {patient.patientNo} · {calcAge(patient.dateOfBirth)} yrs · {patient.gender}
                    {patient.primaryPhone ? ` · ${patient.primaryPhone}` : ''}
                  </p>
                  <p className="text-xs text-slate-400">
                    Registered {new Date(patient.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {onOpenPatient ? (
                  <Button type="button" variant="secondary" onClick={() => onOpenPatient(patient.id)}>
                    View profile
                  </Button>
                ) : null}
              </div>
            ))}
            {!patients.length ? (
              <p className="p-8 text-center text-sm text-slate-500">No patients match your filters.</p>
            ) : null}
          </div>
        )}

        {meta && meta.totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
            <Button type="button" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-sm text-slate-600">
              Page {page} of {meta.totalPages}
            </span>
            <Button
              type="button"
              variant="ghost"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
