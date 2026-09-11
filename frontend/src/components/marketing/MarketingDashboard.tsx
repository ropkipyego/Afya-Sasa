import { useQuery } from '@tanstack/react-query'
import { Alert, Button } from '../ui'
import { apiRequest } from '../../lib/api'
import {
  marketingError,
  type MarketingDashboard as MarketingDashboardData,
  type MarketingPeriodTotals,
} from './marketing-shared'

export function MarketingDashboard({ onOpenDaily }: { onOpenDaily?: () => void }) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['marketing-dashboard'],
    queryFn: () => apiRequest<MarketingDashboardData>('/marketing/dashboard'),
  })

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading your marketing dashboard…</p>
  }

  if (isError || !data) {
    return (
      <div className="space-y-3">
        <Alert tone="error">{marketingError(error, 'Unable to load the marketing dashboard.')}</Alert>
        <Button type="button" variant="secondary" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">My marketing work</h2>
          <p className="text-sm text-slate-600">
            Totals come from activities you recorded. Nothing here is estimated.
          </p>
        </div>
        {onOpenDaily ? (
          <Button type="button" onClick={onOpenDaily}>
            Open daily report
          </Button>
        ) : null}
      </div>
      <PeriodBlock title="Today" totals={data.today} />
      <PeriodBlock title="This week" totals={data.week} />
      <PeriodBlock title="This month" totals={data.month} />
    </div>
  )
}

function PeriodBlock({ title, totals }: { title: string; totals: MarketingPeriodTotals }) {
  const cards = [
    ['Activities', totals.activities],
    ['Locations visited', totals.locationsVisited],
    ['Facilities contacted', totals.facilitiesContacted],
    ['Contacts reached', totals.contactsReached],
    ['People reached', totals.peopleReached],
    ['Leads', totals.leads],
    ['Referrals', totals.referrals],
    ['Follow-ups due', totals.followUpsDue],
    ['Follow-ups completed', totals.followUpsCompleted],
  ] as const

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="font-bold text-slate-900">{title}</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
