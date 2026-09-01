import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Clock, FlaskConical, Sparkles, TestTube2, Timer } from 'lucide-react'
import { apiRequest } from '../../lib/api'
import { LabHero, LabPriorityChip, LabStatCard, LabStatusChip, waitLabel } from './lab-ui'

type LabRequest = {
  id: string
  status: string
  priority: string
  requestNo: string
  createdAt: string
  patient?: { firstName: string; lastName: string; patientNo: string }
}

async function fetchLabRequests(): Promise<LabRequest[]> {
  const res = await apiRequest<{ items: LabRequest[] } | LabRequest[]>('/laboratory/requests?limit=100')
  return Array.isArray(res) ? res : (res.items ?? [])
}

export function LabDashboard({ embedded = false }: { embedded?: boolean }) {
  const { data: requests = [], isLoading, isError, error } = useQuery({
    queryKey: ['lab-requests', 'dashboard'],
    queryFn: fetchLabRequests,
    refetchInterval: 20_000,
  })

  const pending = requests.filter((r) =>
    ['requested', 'sample_collected', 'processing', 'resulted'].includes(r.status),
  )
  const urgent = requests.filter((r) => r.priority === 'stat' || r.priority === 'urgent')
  const verified = requests.filter((r) => r.status === 'verified')
  const aged = pending.filter((r) => Date.now() - new Date(r.createdAt).getTime() > 4 * 60 * 60 * 1000)

  const pipeline = useMemo(() => {
    const stages = ['requested', 'sample_collected', 'processing', 'resulted', 'verified'] as const
    return stages.map((stage) => ({
      stage,
      count: requests.filter((r) => r.status === stage).length,
    }))
  }, [requests])

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 animate-skeleton rounded-2xl" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-sm text-red-800">
        Laboratory dashboard failed to load: {(error as Error)?.message ?? 'Unknown error'}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {!embedded ? (
        <LabHero
          title="Laboratory command center"
          description="Track specimen flow, turnaround pressure, and priority work across hematology, chemistry, microbiology, and serology."
          stats={[
            { label: 'Pending', value: pending.length },
            { label: 'STAT/Urgent', value: urgent.length, tone: 'bg-rose-500/20' },
            { label: 'Verified', value: verified.length, tone: 'bg-emerald-500/20' },
            { label: '>4h wait', value: aged.length, tone: aged.length ? 'bg-amber-500/25' : undefined },
          ]}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <LabStatCard
          label="Active requests"
          value={pending.length}
          icon={FlaskConical}
          tone="border-teal-200/80 bg-gradient-to-br from-teal-50 to-white text-teal-950"
          hint="Awaiting collection through verification"
        />
        <LabStatCard
          label="Priority queue"
          value={urgent.length}
          icon={AlertTriangle}
          tone="border-amber-200 bg-gradient-to-br from-amber-50 to-white text-amber-950"
          hint="STAT and urgent orders"
        />
        <LabStatCard
          label="Completed (loaded)"
          value={verified.length}
          icon={TestTube2}
          tone="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white text-emerald-950"
          hint="Verified in current dataset"
        />
        <LabStatCard
          label="TAT breach risk"
          value={aged.length}
          icon={Timer}
          tone="border-rose-200 bg-gradient-to-br from-rose-50 to-white text-rose-950"
          hint="Waiting over 4 hours"
        />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-teal-600" />
          <h3 className="text-sm font-bold text-slate-900">Specimen pipeline</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          {pipeline.map(({ stage, count }, index) => (
            <div key={stage} className="relative">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center">
                <LabStatusChip status={stage} />
                <p className="mt-3 text-2xl font-bold tabular-nums text-slate-900">{count}</p>
              </div>
              {index < pipeline.length - 1 ? (
                <div className="pointer-events-none absolute right-0 top-1/2 hidden h-px w-3 translate-x-full bg-slate-200 md:block" />
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="text-sm font-bold text-slate-900">Priority work queue</h3>
          <p className="text-xs text-slate-500">Oldest pending requests first</p>
        </div>
        <ul className="divide-y divide-slate-100">
          {pending.slice(0, 10).map((request) => (
            <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
              <div>
                <p className="font-semibold text-slate-900">
                  {request.patient
                    ? `${request.patient.firstName} ${request.patient.lastName}`
                    : 'Unknown patient'}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {request.requestNo} · {request.patient?.patientNo}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <LabStatusChip status={request.status} />
                <LabPriorityChip priority={request.priority} />
                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <Clock className="h-3 w-3" />
                  {waitLabel(request.createdAt)}
                </span>
              </div>
            </li>
          ))}
          {!pending.length ? (
            <li className="px-6 py-12 text-center text-sm text-slate-500">No pending laboratory work — queue is clear.</li>
          ) : null}
        </ul>
      </div>
    </div>
  )
}
