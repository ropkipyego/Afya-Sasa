import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../../lib/api'
import { Card, PageHeader } from '../ui'

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  )
}

export function OpdReportsPanel() {
  const { data } = useQuery({
    queryKey: ['opd-summary'],
    queryFn: () =>
      apiRequest<{
        totalVisits: number
        activeVisits: number
        completedVisits: number
        topDiagnoses: { description: string; count: number }[]
      }>('/opd/reports/summary'),
  })

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <PageHeader title="OPD summary" description="Visit volumes and top diagnoses." />
      </Card>
      <div className="grid gap-6 md:grid-cols-3">
        <MetricCard label="Total OPD visits" value={data?.totalVisits ?? 0} />
        <MetricCard label="Active visits" value={data?.activeVisits ?? 0} />
        <MetricCard label="Completed visits" value={data?.completedVisits ?? 0} />
        <div className="rounded-3xl bg-white p-6 shadow-sm md:col-span-3">
          <h3 className="text-xl font-bold">Top diagnoses</h3>
          <div className="mt-4 divide-y divide-slate-100">
            {(data?.topDiagnoses ?? []).map((diagnosis) => (
              <div key={diagnosis.description} className="flex justify-between py-3">
                <span>{diagnosis.description}</span>
                <span className="font-bold">{diagnosis.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
