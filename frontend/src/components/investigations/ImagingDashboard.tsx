import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Clock, ScanLine, Users } from 'lucide-react'
import { Card, PageHeader } from '../ui'
import { apiRequest } from '../../lib/api'
import { formatPatientNoShort } from '../../lib/patient-utils'
import { LabQueueItem, LabSection, waitLabel } from './lab-ui'

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

async function fetchRadRequests(): Promise<RadRequest[]> {
  const res = await apiRequest<{ items: RadRequest[] } | RadRequest[]>(
    '/radiology/requests?limit=100',
  )
  return Array.isArray(res) ? res : (res.items ?? [])
}

export function ImagingDashboard({
  embedded = false,
  onOpenRequest,
}: {
  embedded?: boolean
  onOpenRequest?: (requestId: string) => void
}) {
  const { data: requests = [], isLoading, isError, error } = useQuery({
    queryKey: ['radiology-requests', 'dashboard'],
    queryFn: fetchRadRequests,
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

  if (isError) {
    return (
      <Card className="p-8">
        <p className="text-sm text-red-700">
          Imaging dashboard failed to load:{' '}
          {(error as Error)?.message ?? 'Unknown error'}
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {!embedded ? (
        <Card className="bg-gradient-to-br from-teal-900 via-slate-900 to-slate-800 p-8 text-white">
          <PageHeader
            title="Imaging dashboard"
            description="Radiology command view — pending studies, modality load, and reporting backlog."
          />
        </Card>
      ) : null}

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

      <LabSection
        title="Quick queue"
        description="Open imaging studies, oldest first. Open a card to report or attach a PDF."
      >
        {pending.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {pending.slice(0, 12).map((request) => (
              <LabQueueItem
                key={request.id}
                onClick={() => onOpenRequest?.(request.id)}
                name={
                  request.patient
                    ? `${request.patient.firstName} ${request.patient.lastName}`
                    : 'Unknown patient'
                }
                patientNo={
                  request.patient?.patientNo
                    ? formatPatientNoShort(request.patient.patientNo)
                    : request.requestNo
                }
                status={request.status}
                priority={request.priority}
                wait={waitLabel(request.createdAt)}
                subtitle={[request.modality?.name, request.bodyPart, request.requestNo]
                  .filter(Boolean)
                  .join(' · ')}
              />
            ))}
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-slate-500">No pending imaging work.</p>
        )}
      </LabSection>
    </div>
  )
}
