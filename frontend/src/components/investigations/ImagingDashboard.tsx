import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Clock, ScanLine, Users } from 'lucide-react'
import { Card, PageHeader } from '../ui'
import { apiRequest } from '../../lib/api'

type RadRequest = {
  id: string
  status: string
  priority: string
  requestNo: string
  bodyPart?: string
  createdAt: string
  patient?: { firstName: string; lastName: string; patientNo: string }
  modality?: { name: string; code: string }
}

function Tile({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string
  value: number
  tone: string
  icon: typeof ScanLine
}) {
  return (
    <div className={`rounded-2xl border p-5 ${tone}`}>
      <Icon className="mb-2 h-5 w-5 opacity-80" />
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

export function ImagingDashboard() {
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['radiology-requests', 'dashboard'],
    queryFn: () => apiRequest<RadRequest[]>('/radiology/requests?limit=100'),
    refetchInterval: 20_000,
  })

  const pending = requests.filter((r) =>
    ['requested', 'scheduled', 'in_progress', 'reported'].includes(r.status),
  )
  const urgent = requests.filter((r) => r.priority === 'stat' || r.priority === 'urgent')
  const verified = requests.filter((r) => r.status === 'verified')
  const aged = pending.filter(
    (r) => Date.now() - new Date(r.createdAt).getTime() > 6 * 60 * 60 * 1000,
  )

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-skeleton rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="bg-gradient-to-br from-teal-900 via-slate-900 to-slate-800 p-8 text-white">
        <PageHeader
          title="Imaging dashboard"
          description="Radiology command view — pending studies, modality load, and reporting backlog."
        />
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Pending studies"
          value={pending.length}
          icon={ScanLine}
          tone="border-teal-200 bg-teal-50 text-teal-900"
        />
        <Tile
          label="Urgent / STAT"
          value={urgent.length}
          icon={AlertTriangle}
          tone="border-amber-200 bg-amber-50 text-amber-900"
        />
        <Tile
          label="Verified (loaded)"
          value={verified.length}
          icon={Users}
          tone="border-emerald-200 bg-emerald-50 text-emerald-900"
        />
        <Tile
          label="Over 6h waiting"
          value={aged.length}
          icon={Clock}
          tone="border-rose-200 bg-rose-50 text-rose-900"
        />
      </div>

      <Card className="p-6">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Imaging worklist snapshot
        </h3>
        <ul className="mt-4 space-y-2">
          {pending.slice(0, 12).map((request) => (
            <li
              key={request.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-semibold">
                  {request.patient
                    ? `${request.patient.firstName} ${request.patient.lastName}`
                    : 'Patient'}{' '}
                  · {request.requestNo}
                </p>
                <p className="text-xs text-slate-500">
                  {request.modality?.name ?? 'Modality'} · {request.bodyPart ?? '—'} ·{' '}
                  {request.status.replace(/_/g, ' ')}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-xs font-bold ${
                  request.priority === 'stat'
                    ? 'bg-rose-100 text-rose-800'
                    : request.priority === 'urgent'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                {request.priority}
              </span>
            </li>
          ))}
          {!pending.length ? (
            <p className="py-8 text-center text-sm text-slate-500">No pending imaging work.</p>
          ) : null}
        </ul>
      </Card>
    </div>
  )
}
