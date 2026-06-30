import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Activity, Database, HardDrive, Server, Users } from 'lucide-react'
import { Card, PageHeader } from '../../ui'
import { apiRequest } from '../../../lib/api'

type HealthData = {
  database: string
  redis: string
  storage: string
  queue: string
  activeUsers: number
  lockedUsers: number
  auditEventsToday: number
  tenant: { name: string; code: string; mohFacilityCode?: string | null } | null
  timestamp: string
}

function StatusTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode
  label: string
  value: string | number
  tone?: 'ok' | 'warn'
}) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="rounded-xl bg-teal-50 p-3 text-teal-700">{icon}</div>
      <div>
        <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
        <p
          className={clsx(
            'mt-1 text-lg font-bold capitalize',
            tone === 'ok' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : 'text-slate-900',
          )}
        >
          {value}
        </p>
      </div>
    </div>
  )
}

export function SystemHealthPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => apiRequest<HealthData>('/admin/system-health'),
    refetchInterval: 20_000,
  })

  if (isLoading || !data) {
    return <Card className="p-8"><p className="text-slate-500">Loading system health…</p></Card>
  }

  return (
    <div className="space-y-8">
      <Card className="p-8">
        <PageHeader
          title="System health"
          description="Live operational status — refreshes every 20 seconds."
        />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <StatusTile icon={<Database className="h-5 w-5" />} label="Database" value={data.database} tone="ok" />
          <StatusTile icon={<Server className="h-5 w-5" />} label="Redis / queue" value={data.redis} tone="ok" />
          <StatusTile icon={<HardDrive className="h-5 w-5" />} label="Storage" value={data.storage} tone="ok" />
          <StatusTile icon={<Activity className="h-5 w-5" />} label="Job queue" value={data.queue} tone="ok" />
          <StatusTile icon={<Users className="h-5 w-5" />} label="Active users" value={data.activeUsers} />
          <StatusTile icon={<Users className="h-5 w-5" />} label="Locked accounts" value={data.lockedUsers} tone={data.lockedUsers ? 'warn' : undefined} />
        </div>
        <p className="mt-6 text-sm text-slate-500">
          Tenant: <span className="font-semibold text-slate-800">{data.tenant?.name ?? '—'}</span>
          {' · '}
          Audit events today: <span className="font-semibold">{data.auditEventsToday}</span>
          {' · '}
          Last check: {new Date(data.timestamp).toLocaleString()}
        </p>
      </Card>
    </div>
  )
}
