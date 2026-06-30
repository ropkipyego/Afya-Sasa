import { useQuery } from '@tanstack/react-query'
import { Card, PageHeader } from '../../ui'
import { apiRequest } from '../../../lib/api'
import { ClinicalReportsDashboard } from '../../reports/ClinicalReportsDashboard'

export function ReportingCenterPanel() {
  const { data: health } = useQuery({
    queryKey: ['system-health'],
    queryFn: () =>
      apiRequest<{
        database: string
        storage: string
        queue: string
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
          <span>DB: {health?.database ?? '—'}</span>
          <span>Storage: {health?.storage ?? '—'}</span>
          <span>Queue: {health?.queue ?? '—'}</span>
          <span>Audit today: {health?.auditEventsToday ?? 0}</span>
        </div>
      </Card>
      <ClinicalReportsDashboard />
    </div>
  )
}
