import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  Baby,
  BedDouble,
  FlaskConical,
  ScanLine,
  Users,
} from 'lucide-react'
import { Card, PageHeader } from '../ui'
import { apiRequest } from '../../lib/api'

type OpsData = {
  generatedAt: string
  patientsToday: number
  admissions: number
  dischargesToday: number | null
  occupancy: { occupied: number; total: number; percent: number }
  pendingLabs: number
  pendingRadiology: number
  criticalPatients: number
  emergencyCases: number
  maternityCases: number
  theatreCases: number
  todayAppointments: number
  totalPatients: number
}

function MetricTile({
  label,
  value,
  icon: Icon,
  tone,
  suffix,
}: {
  label: string
  value: number | string
  icon: typeof Activity
  tone: string
  suffix?: string
}) {
  return (
    <div className={`card-hover rounded-2xl border p-5 ${tone}`}>
      <Icon className="mb-2 h-5 w-5 opacity-80" />
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums">
        {value}
        {suffix ? <span className="text-lg font-semibold">{suffix}</span> : null}
      </p>
    </div>
  )
}

export function OperationsCommandCenter() {
  const { data, isLoading } = useQuery({
    queryKey: ['operations-dashboard'],
    queryFn: () => apiRequest<OpsData>('/reports/operations'),
    refetchInterval: 30_000,
  })

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 animate-skeleton rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <PageHeader
          title="Hospital operations command center"
          description="Executive view for management, nursing leads, and medical superintendent."
        />
        <p className="mt-2 text-xs text-slate-400">
          Last updated: {data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : '—'}
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="OPD patients today"
          value={data?.patientsToday ?? 0}
          icon={Users}
          tone="border-sky-200 bg-sky-50 text-sky-900"
        />
        <MetricTile
          label="Active admissions"
          value={data?.admissions ?? 0}
          icon={BedDouble}
          tone="border-violet-200 bg-violet-50 text-violet-900"
        />
        <MetricTile
          label="Bed occupancy"
          value={data?.occupancy.percent ?? 0}
          suffix="%"
          icon={BedDouble}
          tone="border-teal-200 bg-teal-50 text-teal-900"
        />
        <MetricTile
          label="Today's appointments"
          value={data?.todayAppointments ?? 0}
          icon={Activity}
          tone="border-emerald-200 bg-emerald-50 text-emerald-900"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Pending labs"
          value={data?.pendingLabs ?? 0}
          icon={FlaskConical}
          tone="border-blue-200 bg-blue-50 text-blue-900"
        />
        <MetricTile
          label="Pending radiology"
          value={data?.pendingRadiology ?? 0}
          icon={ScanLine}
          tone="border-indigo-200 bg-indigo-50 text-indigo-900"
        />
        <MetricTile
          label="Critical patients"
          value={data?.criticalPatients ?? 0}
          icon={AlertTriangle}
          tone="border-red-200 bg-red-50 text-red-900"
        />
        <MetricTile
          label="Emergency cases"
          value={data?.emergencyCases ?? 0}
          icon={AlertTriangle}
          tone="border-orange-200 bg-orange-50 text-orange-900"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricTile
          label="Maternity cases"
          value={data?.maternityCases ?? 0}
          icon={Baby}
          tone="border-pink-200 bg-pink-50 text-pink-900"
        />
        <MetricTile
          label="Theatre today"
          value={data?.theatreCases ?? 0}
          icon={Activity}
          tone="border-slate-200 bg-slate-50 text-slate-900"
        />
        <MetricTile
          label="Registered patients"
          value={data?.totalPatients ?? 0}
          icon={Users}
          tone="border-slate-200 bg-white text-slate-900"
        />
      </div>

      <Card className="border-dashed">
        <p className="text-center text-sm text-slate-500">
          Revenue and active users are placeholders for a future finance integration.
        </p>
      </Card>
    </div>
  )
}
