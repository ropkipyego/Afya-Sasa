import { useQuery } from '@tanstack/react-query'
import { Card, PageHeader } from '../../ui'
import { apiRequest } from '../../../lib/api'

export function SuperAdminPanel() {
  const { data: health } = useQuery({
    queryKey: ['system-health'],
    queryFn: () =>
      apiRequest<{
        database: string
        redis: string
        storage: string
        queue: string
        activeUsers: number
        lockedUsers: number
        timestamp: string
        tenant: { name: string; code: string } | null
      }>('/admin/system-health'),
  })

  const opsCommands = [
    { label: 'Preflight check', command: 'npm run preflight' },
    { label: 'Smoke test', command: 'npm run smoke' },
    { label: 'Backup database', command: './ops/backup-postgres.sh' },
    { label: 'Restore database', command: './ops/restore-postgres.sh <backup-file>' },
    { label: 'OPD workflow test', command: './ops/opd-workflow-test.sh' },
    { label: 'IPD workflow test', command: './ops/ipd-workflow-test.sh' },
    { label: 'Full onboarding tests', command: './ops/run-onboarding-tests.sh' },
  ]

  return (
    <div className="space-y-6">
      <Card className="p-8">
        <PageHeader
          title="Super admin tools"
          description="Operations commands, health status, and deployment checks."
        />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Metric label="Active users" value={health?.activeUsers ?? 0} />
          <Metric label="Locked users" value={health?.lockedUsers ?? 0} />
          <Metric label="Tenant" value={health?.tenant?.code ?? '—'} />
        </div>
        <p className="mt-4 text-xs text-slate-500">Last check: {health?.timestamp ? new Date(health.timestamp).toLocaleString() : '—'}</p>
      </Card>

      <Card className="p-8">
        <PageHeader title="Operations scripts" description="Run from project root on the server." />
        <ul className="mt-6 space-y-3">
          {opsCommands.map((item) => (
            <li key={item.command} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-semibold">{item.label}</p>
              <code className="mt-1 block text-xs text-slate-600">{item.command}</code>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-8">
        <PageHeader title="Production checklist" />
        <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-slate-600">
          <li>Set strong secrets in <code>.env</code> (JWT, Postgres, MinIO)</li>
          <li>Configure <code>SMS_PROVIDER</code> for live SMS</li>
          <li>Run migrations on deploy: <code>TYPEORM_MIGRATIONS_RUN=true</code></li>
          <li>Restrict Swagger (<code>/docs</code>) behind admin VPN or disable in production</li>
          <li>Complete <code>docs/go-live-checklist.md</code> before go-live</li>
        </ul>
      </Card>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  )
}
