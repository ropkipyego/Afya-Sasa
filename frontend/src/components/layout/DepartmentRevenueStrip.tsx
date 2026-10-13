import { useQuery } from '@tanstack/react-query'
import { apiRequest, formatApiError, getApiErrorStatus } from '../../lib/api'
import { formatKes } from '../../lib/clinical-catalog'
import type { PaymentServiceLine } from '../../lib/payments'

type DepartmentRevenue = {
  source: string
  charges: number
  collections: number
  chargesByServiceLine: Record<string, number>
  collectionsByServiceLine: Record<string, number>
}

const LABELS: Record<string, string> = {
  consultation: 'Consultation / OPD',
  pharmacy: 'Pharmacy',
  laboratory: 'Laboratory',
  radiology: 'Radiology',
  inpatient: 'Inpatient',
  other: 'Other',
}

export function DepartmentRevenueStrip({
  serviceLine,
}: {
  serviceLine?: PaymentServiceLine | 'all'
}) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['department-revenue', serviceLine ?? 'all'],
    queryFn: () => apiRequest<DepartmentRevenue>('/reports/department-revenue'),
    staleTime: 30_000,
    retry: false,
  })

  if (error) {
    const status = getApiErrorStatus(error)
    if (status === 401 || status === 403) return null
    return (
      <p className="text-xs text-slate-500">
        {formatApiError(error, 'Department collections are not available for this role.')}
      </p>
    )
  }
  if (isLoading || !data) {
    return <p className="text-xs text-slate-500">Loading department collections…</p>
  }

  const lines =
    serviceLine && serviceLine !== 'all'
      ? [serviceLine]
      : Object.keys({ ...data.chargesByServiceLine, ...data.collectionsByServiceLine })

  const charges =
    serviceLine && serviceLine !== 'all'
      ? Number(data.chargesByServiceLine[serviceLine] ?? 0)
      : data.charges
  const collections =
    serviceLine && serviceLine !== 'all'
      ? Number(data.collectionsByServiceLine[serviceLine] ?? 0)
      : data.collections

  return (
    <div className="min-w-[16rem] rounded-2xl border border-teal-100 bg-teal-50/70 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-800">
        {serviceLine && serviceLine !== 'all' ? `${LABELS[serviceLine] ?? serviceLine} · 30 days` : 'Department collections · 30 days'}
      </p>
      <p className="mt-1 text-sm font-bold text-slate-900">
        Collected {formatKes(collections)}
        <span className="ml-2 font-medium text-slate-500">Charged {formatKes(charges)}</span>
      </p>
      {lines.length > 1 ? (
        <p className="mt-1 text-[11px] text-slate-500">
          {lines
            .slice(0, 6)
            .map((line) => `${LABELS[line] ?? line} ${formatKes(Number(data.collectionsByServiceLine[line] ?? 0))}`)
            .join(' · ')}
        </p>
      ) : null}
      <p className="mt-1 text-[10px] leading-snug text-slate-500">{data.source}</p>
    </div>
  )
}
