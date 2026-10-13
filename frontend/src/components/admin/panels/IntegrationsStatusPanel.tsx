import { useQuery } from '@tanstack/react-query'
import { Alert, Card, PageHeader } from '../../ui'
import { apiRequest, formatApiError } from '../../../lib/api'

export function IntegrationsStatusPanel() {
  const health = useQuery({
    queryKey: ['system-health'],
    queryFn: () => apiRequest<Record<string, { status?: string; detail?: string }>>('/admin/system-health'),
  })
  const fhir = useQuery({
    queryKey: ['fhir-status'],
    queryFn: () => apiRequest<{ connected?: boolean; reason?: string }>('/integrations/fhir/status'),
  })

  const rows = [
    { name: 'SHA claims', status: health.data?.sha?.status ?? 'Unknown', detail: 'Portal claims stay on portal.sha.go.ke. Drafts are not submissions.' },
    {
      name: 'DHA FHIR',
      status: fhir.data?.connected ? 'Healthy' : 'Not Configured',
      detail: fhir.data?.reason ?? 'Local mapping is not a sandbox connection.',
    },
    { name: 'Email', status: health.data?.email?.status ?? 'Unknown', detail: health.data?.email?.detail },
    { name: 'SMS', status: health.data?.sms?.status ?? 'Unknown', detail: health.data?.sms?.detail },
    { name: 'Object storage', status: health.data?.storage?.status ?? 'Unknown', detail: health.data?.storage?.detail },
    { name: 'QuickBooks GL', status: health.data?.accounting?.status ?? 'Not Configured', detail: health.data?.accounting?.detail },
  ]

  return (
    <Card className="p-8">
      <PageHeader
        title="Integrations"
        description="Configuration is not connectivity. A mapped resource is not a live government exchange."
      />
      {health.isError ? <Alert tone="error" className="mt-4">{formatApiError(health.error, 'Health unavailable.')}</Alert> : null}
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {rows.map((row) => (
          <div key={row.name} className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-bold uppercase text-slate-500">{row.name}</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{row.status}</p>
            <p className="mt-1 text-sm text-slate-600">{row.detail}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}
