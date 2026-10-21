import { useQuery } from '@tanstack/react-query'
import { apiRequest, formatApiError, getApiErrorStatus } from '../../lib/api'
import { formatKes } from '../../lib/clinical-catalog'
import { useAuthStore } from '../../lib/auth-store'
import type { PaymentServiceLine } from '../../lib/payments'

type DepartmentRevenue = {
  available?: boolean
  source: string
  generatedAt?: string
  range?: { from: string; to: string }
  charges: number | null
  collections: number | null
  refunds?: number
  outstanding?: number
  chargesByServiceLine: Record<string, number>
  collectionsByServiceLine: Record<string, number>
  reason?: string
}

const LABELS: Record<string, string> = {
  consultation: 'Consultation / OPD',
  pharmacy: 'Pharmacy',
  laboratory: 'Laboratory',
  radiology: 'Radiology',
  inpatient: 'Inpatient',
  other: 'Other',
}

function canSeeRevenue(permissions: string[], roles: string[]) {
  return (
    permissions.includes('payments:read') ||
    permissions.includes('payments:initiate') ||
    roles.some((role) => ['director', 'administrator', 'superadmin'].includes(role.toLowerCase()))
  )
}

export function DepartmentRevenueStrip({
  serviceLine,
}: {
  serviceLine?: PaymentServiceLine | 'all'
}) {
  const user = useAuthStore((state) => state.user)
  const allowed = canSeeRevenue(user?.permissions ?? [], user?.roles ?? [])
  const { data, error, isLoading, isError } = useQuery({
    queryKey: ['revenue-summary', serviceLine ?? 'all'],
    queryFn: () => apiRequest<DepartmentRevenue>('/reports/revenue-summary'),
    staleTime: 30_000,
    retry: false,
    enabled: allowed,
  })

  if (!allowed) {
    return (
      <p className="max-w-xs text-[11px] leading-snug text-slate-500">
        Charge and collection totals are shown to cashier, finance and director roles only.
      </p>
    )
  }

  if (error) {
    const status = getApiErrorStatus(error)
    if (status === 401 || status === 403) {
      return (
        <p className="max-w-xs text-[11px] leading-snug text-slate-500">
          Revenue summary is not authorised for this session.
        </p>
      )
    }
    return (
      <p className="max-w-xs text-[11px] leading-snug text-rose-700">
        {formatApiError(error, 'Revenue summary could not be loaded.')}
      </p>
    )
  }

  if (isLoading || (!data && !isError)) {
    return <p className="text-xs text-slate-500">Loading revenue summary…</p>
  }

  if (!data || data.available === false || data.charges == null || data.collections == null) {
    return (
      <p className="max-w-xs text-[11px] leading-snug text-slate-500">
        {data?.reason ?? 'Revenue summary is unavailable. Totals are not shown as zero.'}
      </p>
    )
  }

  const charges =
    serviceLine && serviceLine !== 'all'
      ? Number(data.chargesByServiceLine[serviceLine] ?? 0)
      : data.charges
  const collections =
    serviceLine && serviceLine !== 'all'
      ? Number(data.collectionsByServiceLine?.[serviceLine] ?? data.collections)
      : data.collections

  return (
    <div className="min-w-[16rem] max-w-full rounded-2xl border border-teal-100 bg-teal-50/70 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-800">
        {serviceLine && serviceLine !== 'all'
          ? `${LABELS[serviceLine] ?? serviceLine} · cashier ledger`
          : 'Hospital cashier ledger'}
      </p>
      <p className="mt-1 text-sm font-bold text-slate-900">
        Collected {formatKes(collections)}
        <span className="ml-2 font-medium text-slate-500">Charged {formatKes(charges)}</span>
      </p>
      <p className="mt-1 text-[11px] text-slate-600">
        Outstanding {formatKes(data.outstanding ?? 0)}
        {data.refunds != null ? ` · Refunds ${formatKes(data.refunds)}` : ''}
      </p>
      <p className="mt-1 text-[10px] leading-snug text-slate-500">
        {data.range ? `${data.range.from} to ${data.range.to}. ` : ''}
        {data.generatedAt ? `Updated ${new Date(data.generatedAt).toLocaleString('en-KE')}. ` : ''}
        Collected is posted payments, not profit. {data.source}
      </p>
    </div>
  )
}
