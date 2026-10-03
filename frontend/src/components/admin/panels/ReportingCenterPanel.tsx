import { useQuery } from '@tanstack/react-query'
import { Card, PageHeader } from '../../ui'
import { apiRequest } from '../../../lib/api'
import { ClinicalReportsDashboard } from '../../reports/ClinicalReportsDashboard'

export function ReportingCenterPanel() {
  const { data: health } = useQuery({
    queryKey: ['system-health'],
    queryFn: () =>
      apiRequest<{
        database: string | { status: string }
        storage: string | { status: string }
        queue: string | { status: string }
        auditEventsToday: number
      }>('/admin/system-health'),
  })

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <PageHeader
          title="Reporting center"
          description="Operational and clinical reports with CSV and printable exports."
        />
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
          <span>DB: {typeof health?.database === 'string' ? health.database : health?.database?.status ?? '—'}</span>
          <span>Storage: {typeof health?.storage === 'string' ? health.storage : health?.storage?.status ?? '—'}</span>
          <span>Queue: {typeof health?.queue === 'string' ? health.queue : health?.queue?.status ?? '—'}</span>
          <span>Audit today: {health?.auditEventsToday ?? 0}</span>
        </div>
      </Card>
      <ClinicalReportsDashboard />
    </div>
  )
}
