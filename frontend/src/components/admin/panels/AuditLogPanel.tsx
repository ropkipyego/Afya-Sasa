import { useQuery } from '@tanstack/react-query'
import { Card, PageHeader } from '../../ui'
import { apiRequest } from '../../../lib/api'

export function AuditLogPanel() {
  const { data } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () =>
      apiRequest<{
        items: {
          id: string
          action: string
          endpoint: string
          httpCode: number
          createdAt: string
        }[]
      }>('/admin/audit-logs'),
  })

  return (
    <Card className="p-8">
      <PageHeader title="Audit logs" description="Compliance trail of user actions and record changes." />
      <div className="mt-6 divide-y divide-slate-100">
        {(data?.items ?? []).map((entry) => (
          <div key={entry.id} className="py-3 text-sm">
            <p className="font-semibold">
              {entry.action.toUpperCase()} · {entry.httpCode}
            </p>
            <p className="text-slate-500">{entry.endpoint}</p>
            <p className="text-xs text-slate-400">{new Date(entry.createdAt).toLocaleString()}</p>
          </div>
        ))}
        {!data?.items?.length ? (
          <p className="py-12 text-center text-sm text-slate-500">No audit events recorded yet.</p>
        ) : null}
      </div>
    </Card>
  )
}
