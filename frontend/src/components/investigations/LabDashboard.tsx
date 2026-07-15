import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Clock, FlaskConical, Users } from 'lucide-react'
import { Card, PageHeader } from '../ui'
import { apiRequest } from '../../lib/api'

type LabRequest = {
  id: string
  status: string
  priority: string
  requestNo: string
  createdAt: string
  patient?: { firstName: string; lastName: string; patientNo: string }
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
  icon: typeof FlaskConical
}) {
  return (
    <div className={`rounded-2xl border p-5 ${tone}`}>
      <Icon className="mb-2 h-5 w-5 opacity-80" />
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

export function LabDashboard() {
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['lab-requests', 'dashboard'],
    queryFn: () => apiRequest<LabRequest[]>('/laboratory/requests?limit=100'),
    refetchInterval: 20_000,
  })

  const pending = requests.filter((r) =>
    ['requested', 'sample_collected', 'processing', 'resulted'].includes(r.status),
  )
  const urgent = requests.filter((r) => r.priority === 'stat' || r.priority === 'urgent')
  const verified = requests.filter((r) => r.status === 'verified')
  const aged = pending.filter(
    (r) => Date.now() - new Date(r.createdAt).getTime() > 4 * 60 * 60 * 1000,
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
      <Card className="bg-gradient-to-br from-blue-900 via-slate-900 to-slate-800 p-8 text-white">
        <PageHeader
          title="Laboratory dashboard"
          description="Live view of samples in progress, urgent work, and turnaround pressure."
        />
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Pending requests"
          value={pending.length}
          icon={FlaskConical}
          tone="border-blue-200 bg-blue-50 text-blue-900"
        />
        <Tile
          label="Urgent / STAT"
          value={urgent.length}
          icon={AlertTriangle}
          tone="border-amber-200 bg-amber-50 text-amber-900"
        />
        <Tile
          label="Verified today (loaded)"
          value={verified.length}
          icon={Users}
          tone="border-emerald-200 bg-emerald-50 text-emerald-900"
        />
        <Tile
          label="Over 4h waiting"
          value={aged.length}
          icon={Clock}
          tone="border-rose-200 bg-rose-50 text-rose-900"
        />
      </div>

      <Card className="p-6">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Priority queue
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
                  {request.status.replace(/_/g, ' ')} · {new Date(request.createdAt).toLocaleString()}
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
            <p className="py-8 text-center text-sm text-slate-500">No pending laboratory work.</p>
          ) : null}
        </ul>
      </Card>
    </div>
  )
}
