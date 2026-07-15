import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, User } from 'lucide-react'
import clsx from 'clsx'
import { apiRequest } from '../../lib/api'
import { Button, Card, Input, PageHeader } from '../ui'

type WorklistModule =
  | 'opd'
  | 'ipd'
  | 'emergency'
  | 'laboratory'
  | 'radiology'
  | 'registration'

type Paginated<T> = {
  items: T[]
  meta: { page: number; pageSize: number; total: number; totalPages: number }
}

type WorklistRow = {
  id?: string
  status?: string
  workflowStage?: string
  patientNo?: string
  firstName?: string
  lastName?: string
  createdAt?: string
  startedAt?: string
  admittedAt?: string
  arrivalTime?: string
  patient?: {
    id?: string
    patientNo?: string
    firstName?: string
    lastName?: string
    primaryPhone?: string
  }
}

export type ModulePatientDirectoryConfig = {
  title: string
  description: string
  module: WorklistModule
  queues: { key: string; label: string }[]
  defaultQueue: string
  onOpenPatient?: (patientId: string) => void
}

function patientIdFromRow(row: WorklistRow) {
  if (row.patient?.id) return row.patient.id
  if (row.patientNo && row.firstName && row.id) return row.id
  return null
}

function patientLabel(row: WorklistRow) {
  const patient = row.patient
  const first = row.firstName ?? patient?.firstName
  const last = row.lastName ?? patient?.lastName
  const mrn = row.patientNo ?? patient?.patientNo
  const name = `${first ?? ''} ${last ?? ''}`.trim()
  if (name) return `${name}${mrn ? ` · ${mrn}` : ''}`
  return mrn ?? '—'
}

function rowTimestamp(row: WorklistRow) {
  const raw = row.createdAt ?? row.startedAt ?? row.admittedAt ?? row.arrivalTime
  return raw ? new Date(String(raw)).toLocaleString() : '—'
}

export function ModulePatientDirectory({
  title,
  description,
  module,
  queues,
  defaultQueue,
  onOpenPatient,
}: ModulePatientDirectoryConfig) {
  const [queue, setQueue] = useState(defaultQueue)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const activeQueue = queues.some((item) => item.key === queue) ? queue : defaultQueue

  const { data, isFetching, isLoading } = useQuery({
    queryKey: ['module-patients', module, activeQueue, page, query],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' })
      if (query.trim()) params.set('q', query.trim())
      return apiRequest<Paginated<WorklistRow>>(
        `/worklists/${module}/${activeQueue}?${params}`,
      )
    },
    refetchInterval: 25_000,
  })

  const rows = data?.items ?? []
  const meta = data?.meta

  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <PageHeader title={title} description={description} />
      </Card>

      <div className="flex flex-wrap gap-2">
        {queues.map((item) => (
          <button
            key={item.key}
            type="button"
            className={clsx(
              'rounded-full px-4 py-2 text-sm font-semibold transition',
              activeQueue === item.key
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
            )}
            onClick={() => {
              setQueue(item.key)
              setPage(1)
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <Card className="p-4">
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search name, MRN, phone…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-14 animate-skeleton rounded-lg" />
            ))}
          </div>
        ) : rows.length ? (
          <ul className="divide-y divide-slate-100">
            {rows.map((row, index) => {
              const patientId = patientIdFromRow(row)
              return (
                <li key={String(row.id ?? index)}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-teal-50/50"
                    onClick={() => {
                      if (patientId && onOpenPatient) onOpenPatient(patientId)
                    }}
                    disabled={!patientId || !onOpenPatient}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                        <User className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{patientLabel(row)}</p>
                        <p className="text-sm text-slate-500">
                          {String(row.status ?? row.workflowStage ?? 'active').replace(/_/g, ' ')}
                          {' · '}
                          {rowTimestamp(row)}
                        </p>
                      </div>
                    </div>
                    {onOpenPatient && patientId ? (
                      <span className="shrink-0 rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-800">
                        Open
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="py-16 text-center text-sm text-slate-500">
            No patients in this queue
            {query.trim() ? ` matching “${query.trim()}”` : ''}.
          </p>
        )}

        {meta ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
            <p className="text-xs text-slate-500">
              {meta.total} patients · page {meta.page} of {meta.totalPages}
              {isFetching ? ' · refreshing…' : ''}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="px-3 py-1.5 text-xs"
                disabled={meta.page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                className="px-3 py-1.5 text-xs"
                disabled={meta.page >= meta.totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
