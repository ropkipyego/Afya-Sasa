import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList, Search } from 'lucide-react'
import clsx from 'clsx'
import { apiRequest } from '../../lib/api'
import { Button, Card, Input, PageHeader, SelectField } from '../ui'

type WorklistCatalog = Record<string, string[]>

type Paginated<T> = {
  items: T[]
  meta: { page: number; pageSize: number; total: number; totalPages: number }
}

type WorklistRow = Record<string, unknown> & {
  id?: string
  patientNo?: string
  firstName?: string
  lastName?: string
  status?: string
  createdAt?: string
  startedAt?: string
  admittedAt?: string
  arrivalTime?: string
  requestNo?: string
  patient?: {
    patientNo?: string
    firstName?: string
    lastName?: string
  }
}

const moduleLabels: Record<string, string> = {
  registration: 'Registration',
  opd: 'OPD',
  emergency: 'Emergency',
  ipd: 'Inpatient',
  laboratory: 'Laboratory',
  radiology: 'Radiology',
}

const listLabels: Record<string, string> = {
  'recently-registered': 'Recently registered',
  today: 'Registered today',
  inactive: 'Inactive (no visit 12+ months)',
  'missing-information': 'Missing information',
  'duplicate-candidates': 'Duplicate candidates',
  waiting: 'Waiting',
  triaged: 'Triaged',
  'with-doctor': 'With doctor',
  'investigations-pending': 'Investigations pending',
  completed: 'Completed',
  red: 'Red (immediate)',
  orange: 'Orange (very urgent)',
  yellow: 'Yellow (urgent)',
  green: 'Green (standard)',
  observation: 'Observation',
  discharged: 'Discharged',
  'current-admissions': 'Current admissions',
  'expected-discharges': 'Expected discharges',
  critical: 'Critical / ICU-HDU',
  requested: 'Requested',
  collected: 'Sample collected',
  processing: 'Processing',
  verified: 'Verified',
  scheduled: 'Scheduled',
  'in-progress': 'In progress',
  reported: 'Reported',
  reviewed: 'Reviewed',
}

function formatListKey(key: string) {
  return listLabels[key] ?? key.replace(/-/g, ' ')
}

function patientLabel(row: WorklistRow) {
  const patient = row.patient
  const first = row.firstName ?? patient?.firstName
  const last = row.lastName ?? patient?.lastName
  const mrn = row.patientNo ?? patient?.patientNo
  if (first || last) {
    return `${first ?? ''} ${last ?? ''}`.trim() + (mrn ? ` · ${mrn}` : '')
  }
  return mrn ?? row.requestNo ?? row.id ?? '—'
}

function rowTimestamp(row: WorklistRow) {
  const raw = row.createdAt ?? row.startedAt ?? row.admittedAt ?? row.arrivalTime
  return raw ? new Date(String(raw)).toLocaleString() : '—'
}

export function OperationalWorklists() {
  const { data: catalog } = useQuery({
    queryKey: ['worklists-catalog'],
    queryFn: () => apiRequest<WorklistCatalog>('/worklists'),
  })

  const modules = useMemo(() => Object.keys(catalog ?? {}), [catalog])
  const [module, setModule] = useState('registration')
  const [listKey, setListKey] = useState('today')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const lists = catalog?.[module] ?? []

  const activeModule = modules.includes(module) ? module : (modules[0] ?? 'registration')
  const activeList = lists.includes(listKey) ? listKey : (lists[0] ?? 'today')

  const { data, isFetching, isLoading } = useQuery({
    queryKey: ['worklist', activeModule, activeList, page, query],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '20',
      })
      if (query.trim()) params.set('q', query.trim())
      return apiRequest<Paginated<WorklistRow>>(
        `/worklists/${activeModule}/${activeList}?${params}`,
      )
    },
    enabled: Boolean(catalog && activeList),
    refetchInterval: 30_000,
  })

  const rows = data?.items ?? []
  const meta = data?.meta

  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <PageHeader
          title="Operational worklists"
          description="Unified, paginated queues across registration, OPD, ED, IPD, lab, and radiology."
        />
      </Card>

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <Card className="p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Module</p>
          <div className="space-y-1">
            {modules.map((key) => (
              <button
                key={key}
                type="button"
                className={clsx(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition',
                  activeModule === key
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-700 hover:bg-slate-100',
                )}
                onClick={() => {
                  setModule(key)
                  const first = catalog?.[key]?.[0]
                  if (first) setListKey(first)
                  setPage(1)
                }}
              >
                <ClipboardList className="h-4 w-4 shrink-0 opacity-80" />
                {moduleLabels[key] ?? key}
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1">
                <SelectField
                  name="listKey"
                  label="Queue"
                  value={activeList}
                  onChange={(event) => {
                    setListKey(event.target.value)
                    setPage(1)
                  }}
                >
                  {lists.map((key) => (
                    <option key={key} value={key}>
                      {formatListKey(key)}
                    </option>
                  ))}
                </SelectField>
              </div>
              <div className="min-w-[220px] flex-[2]">
                <label className="mb-1 block text-xs font-semibold text-slate-600">Search</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    className="pl-9"
                    placeholder="Name, MRN, request no…"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value)
                      setPage(1)
                    }}
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-12 animate-skeleton rounded-lg" />
                ))}
              </div>
            ) : rows.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Patient / record</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row, index) => (
                      <tr key={String(row.id ?? index)} className="hover:bg-teal-50/40">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {patientLabel(row)}
                        </td>
                        <td className="px-4 py-3 capitalize text-slate-600">
                          {String(row.status ?? row.workflowStage ?? '—').replace(/_/g, ' ')}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{rowTimestamp(row)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-16 text-center text-sm text-slate-500">
                No items in this queue{query.trim() ? ` matching “${query.trim()}”` : ''}.
              </p>
            )}

            {meta ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
                <p className="text-xs text-slate-500">
                  {meta.total} total · page {meta.page} of {meta.totalPages}
                  {isFetching ? ' · refreshing…' : ''}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="px-3 py-1.5 text-xs"
                    disabled={meta.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    className="px-3 py-1.5 text-xs"
                    disabled={meta.page >= meta.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  )
}
