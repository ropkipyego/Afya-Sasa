import { useQuery } from '@tanstack/react-query'
import { Alert, Card, PageHeader } from '../ui'
import { apiRequest, formatApiError } from '../../lib/api'

type Mapping = {
  electronicSubmissionOperational: boolean
  note: string
  forms: Array<{
    code: string
    officialName: string
    period: string
    source: string
    endpoint: string | null
    submission: string
    gaps: string[]
  }>
}

export function MohMappingPanel() {
  const { data, isError, error } = useQuery({
    queryKey: ['moh-mapping'],
    queryFn: () => apiRequest<Mapping>('/reports/moh/mapping'),
  })

  return (
    <Card className="p-6 md:p-8">
      <PageHeader
        title="Ministry of Health forms"
        description="Internal projections only. Electronic KHIS submission is not operational."
      />
      {data?.note ? <Alert tone="warning" className="mt-4">{data.note}</Alert> : null}
      {isError ? <Alert tone="error" className="mt-4">{formatApiError(error, 'Mapping unavailable.')}</Alert> : null}
      <div className="mt-6 space-y-3">
        {(data?.forms ?? []).map((form) => (
          <section key={form.code} className="rounded-2xl border border-slate-200 p-4">
            <p className="font-bold text-slate-900">
              {form.code} — {form.officialName}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Period: {form.period} · Source: {form.source} · Submission: {form.submission}
            </p>
            <p className="mt-1 text-xs text-slate-500">{form.endpoint ?? 'No endpoint — official spec missing'}</p>
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
              {form.gaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Card>
  )
}
