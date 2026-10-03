import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Activity, Database, HardDrive, Mail, Server, Shield, Smartphone, Users } from 'lucide-react'
import { Alert, Button, Card, PageHeader } from '../../ui'
import { apiRequest, formatApiError } from '../../../lib/api'

type HealthStatus = string | { status: string; detail?: string }

type HealthData = {
  database: HealthStatus
  redis: HealthStatus
  storage: HealthStatus
  queue: HealthStatus
  email?: HealthStatus
  sms?: HealthStatus
  biometric?: HealthStatus
  sha?: HealthStatus
  accounting?: HealthStatus
  api?: HealthStatus
  activeUsers: number
  lockedUsers: number
  auditEventsToday: number
  tenant: { name: string; code: string; mohFacilityCode?: string | null } | null
  timestamp: string
}

function statusText(value?: HealthStatus) {
  if (!value) return 'Data unavailable'
  return typeof value === 'string' ? value : value.status
}

function statusDetail(value?: HealthStatus) {
  return typeof value === 'object' && value ? value.detail : undefined
}

function toneFor(status: string): 'ok' | 'warn' | undefined {
  if (status === 'HEALTHY' || status === 'connected' || status === 'available') return 'ok'
  if (status === 'NOT_CONFIGURED' || status === 'NOT_VERIFIED' || status === 'UNAVAILABLE' || status === 'BLOCKED') {
    return 'warn'
  }
  return undefined
}

function StatusTile({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode
  label: string
  value: string | number
  detail?: string
}) {
  const tone = typeof value === 'string' ? toneFor(value) : undefined
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="rounded-xl bg-teal-50 p-3 text-teal-700">{icon}</div>
      <div>
        <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
        <p
          className={clsx(
            'mt-1 text-lg font-bold',
            tone === 'ok' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : 'text-slate-900',
          )}
        >
          {value}
        </p>
        {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
      </div>
    </div>
  )
}

export function SystemHealthPanel() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => apiRequest<HealthData>('/admin/system-health'),
    refetchInterval: 20_000,
  })

  if (isError) {
    return (
      <Card className="space-y-3 p-8">
        <Alert tone="error">
          <p className="font-semibold">Unable to load system health.</p>
          <p>{formatApiError(error, 'The server did not complete the request.')}</p>
        </Alert>
        <Button type="button" variant="secondary" onClick={() => refetch()}>
          Retry
        </Button>
      </Card>
    )
  }

  if (isLoading || !data) {
    return <Card className="p-8"><p className="text-slate-500">Loading system health…</p></Card>
  }

  return (
    <div className="space-y-8">
      <Card className="p-8">
        <PageHeader
          title="System health"
          description="Configured versus verified. An endpoint existing is not treated as healthy."
        />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <StatusTile icon={<Server className="h-5 w-5" />} label="API" value={statusText(data.api)} detail={statusDetail(data.api)} />
          <StatusTile icon={<Database className="h-5 w-5" />} label="Database" value={statusText(data.database)} detail={statusDetail(data.database)} />
          <StatusTile icon={<Server className="h-5 w-5" />} label="Redis" value={statusText(data.redis)} detail={statusDetail(data.redis)} />
          <StatusTile icon={<HardDrive className="h-5 w-5" />} label="MinIO" value={statusText(data.storage)} detail={statusDetail(data.storage)} />
          <StatusTile icon={<Activity className="h-5 w-5" />} label="Job queue" value={statusText(data.queue)} detail={statusDetail(data.queue)} />
          <StatusTile icon={<Mail className="h-5 w-5" />} label="Email" value={statusText(data.email)} detail={statusDetail(data.email)} />
          <StatusTile icon={<Smartphone className="h-5 w-5" />} label="SMS" value={statusText(data.sms)} detail={statusDetail(data.sms)} />
          <StatusTile icon={<Shield className="h-5 w-5" />} label="Biometric agent" value={statusText(data.biometric)} detail={statusDetail(data.biometric)} />
          <StatusTile icon={<Shield className="h-5 w-5" />} label="SHA / DHA" value={statusText(data.sha)} detail={statusDetail(data.sha)} />
          <StatusTile icon={<Activity className="h-5 w-5" />} label="Accounting" value={statusText(data.accounting)} detail={statusDetail(data.accounting)} />
          <StatusTile icon={<Users className="h-5 w-5" />} label="Active users" value={data.activeUsers} />
          <StatusTile icon={<Users className="h-5 w-5" />} label="Locked accounts" value={data.lockedUsers} />
        </div>
        <p className="mt-6 text-sm text-slate-500">
          Tenant: <span className="font-semibold text-slate-800">{data.tenant?.name ?? '—'}</span>
          {' · '}
          Audit events today: <span className="font-semibold">{data.auditEventsToday}</span>
          {' · '}
          Last updated: {new Date(data.timestamp).toLocaleString()}
        </p>
      </Card>
    </div>
  )
}
