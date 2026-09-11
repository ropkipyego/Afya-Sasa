import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Field, SelectField } from '../ui'
import { apiRequest } from '../../lib/api'
import {
  MARKETING_ACTIVITY_TYPES,
  MARKETING_OUTCOMES,
  activityTypeLabel,
  marketingError,
  outcomeLabel,
  todayIso,
  type MarketingActivity,
  type MarketingActivityList,
  type MarketingGroupRow,
  type MarketingTeamSummary,
} from './marketing-shared'

function shiftDate(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export function MarketingTeamReport() {
  const today = todayIso()
  const [from, setFrom] = useState(() => shiftDate(today, -30))
  const [to, setTo] = useState(today)
  const [staffId, setStaffId] = useState('')
  const [location, setLocation] = useState('')
  const [facility, setFacility] = useState('')
  const [activityType, setActivityType] = useState('')
  const [outcome, setOutcome] = useState('')
  const [service, setService] = useState('')
  const [page, setPage] = useState(1)

  const query = useMemo(() => {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (staffId) params.set('staffId', staffId)
    if (location.trim()) params.set('location', location.trim())
    if (facility.trim()) params.set('facility', facility.trim())
    if (activityType) params.set('activityType', activityType)
    if (outcome) params.set('outcome', outcome)
    if (service.trim()) params.set('service', service.trim())
    return params.toString()
  }, [from, to, staffId, location, facility, activityType, outcome, service])

  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
    error: summaryQueryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['marketing-team-summary', query],
    queryFn: () => apiRequest<MarketingTeamSummary>(`/marketing/reports/summary?${query}`),
  })

  const {
    data: list,
    isLoading: listLoading,
    isError: listError,
    error: listQueryError,
    refetch: refetchList,
  } = useQuery({
    queryKey: ['marketing-activities', 'team', query, page],
    queryFn: () =>
      apiRequest<MarketingActivityList>(`/marketing/activities?${query}&page=${page}&pageSize=25`),
  })

  const staffOptions = summary?.byStaff ?? []

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold text-slate-900">Team marketing report</h2>
        <p className="mt-1 text-sm text-slate-600">
          Volume and outcomes from recorded activities. Filter, then open the matching rows below.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          <Field name="from" label="From" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} />
          <Field name="to" label="To" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} />
          <SelectField
            name="staffId"
            label="Staff"
            value={staffId}
            onChange={(e) => {
              setStaffId(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All staff</option>
            {staffOptions.map((row) => (
              <option key={row.key} value={row.key}>
                {row.label}
              </option>
            ))}
          </SelectField>
          <Field name="location" label="Location" value={location} onChange={(e) => { setLocation(e.target.value); setPage(1) }} />
          <Field name="facility" label="Facility" value={facility} onChange={(e) => { setFacility(e.target.value); setPage(1) }} />
          <SelectField name="activityType" label="Activity type" value={activityType} onChange={(e) => { setActivityType(e.target.value); setPage(1) }}>
            <option value="">All types</option>
            {MARKETING_ACTIVITY_TYPES.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </SelectField>
          <SelectField name="outcome" label="Outcome" value={outcome} onChange={(e) => { setOutcome(e.target.value); setPage(1) }}>
            <option value="">All outcomes</option>
            {MARKETING_OUTCOMES.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </SelectField>
          <Field name="service" label="Service" value={service} onChange={(e) => { setService(e.target.value); setPage(1) }} />
        </div>
      </section>

      {summaryLoading ? (
        <p className="text-sm text-slate-500">Loading team totals…</p>
      ) : summaryError ? (
        <div className="space-y-3">
          <Alert tone="error">{marketingError(summaryQueryError, 'Unable to load team totals.')}</Alert>
          <Button type="button" variant="secondary" onClick={() => refetchSummary()}>Retry</Button>
        </div>
      ) : summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Activities" value={summary.totals.activities} />
            <Stat label="People reached" value={summary.totals.peopleReached} />
            <Stat label="Leads" value={summary.totals.leads} />
            <Stat label="Referrals" value={summary.totals.referrals} />
            <Stat label="Locations" value={summary.totals.locationsVisited} />
            <Stat label="Facilities" value={summary.totals.facilitiesContacted} />
            <Stat label="Pending follow-ups" value={summary.pendingFollowUps} />
            <Stat label="Completed follow-ups" value={summary.completedFollowUps} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <GroupTable title="By staff" rows={summary.byStaff} showOutcomes />
            <GroupTable title="By date" rows={summary.byDate} />
            <GroupTable title="By location" rows={summary.byLocation} />
            <GroupTable title="By facility" rows={summary.byFacility} />
            <GroupTable title="By activity type" rows={summary.byActivityType.map((row) => ({ ...row, label: activityTypeLabel(row.label) }))} />
            <GroupTable title="By outcome" rows={summary.byOutcome.map((row) => ({ ...row, label: outcomeLabel(row.label === 'Unspecified' ? null : row.label) }))} />
            <GroupTable title="Services promoted" rows={summary.byService} />
          </div>
        </>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-bold text-slate-900">Matching activities</h3>
        {listLoading ? (
          <p className="mt-3 text-sm text-slate-500">Loading records…</p>
        ) : listError ? (
          <div className="mt-3 space-y-3">
            <Alert tone="error">{marketingError(listQueryError, 'Unable to load activities.')}</Alert>
            <Button type="button" variant="secondary" onClick={() => refetchList()}>Retry</Button>
          </div>
        ) : list?.items.length ? (
          <>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2">Date</th>
                    <th className="px-2 py-2">Staff</th>
                    <th className="px-2 py-2">Facility</th>
                    <th className="px-2 py-2">Type</th>
                    <th className="px-2 py-2">Reached</th>
                    <th className="px-2 py-2">Leads</th>
                    <th className="px-2 py-2">Referrals</th>
                    <th className="px-2 py-2">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((row: MarketingActivity) => (
                    <tr key={row.id} className="border-b border-slate-100">
                      <td className="px-2 py-2">{row.activityDate}</td>
                      <td className="px-2 py-2">{row.ownerName}</td>
                      <td className="px-2 py-2">
                        {row.facilityName}
                        {row.location ? <p className="text-xs text-slate-500">{row.location}</p> : null}
                      </td>
                      <td className="px-2 py-2">{activityTypeLabel(row.activityType)}</td>
                      <td className="px-2 py-2">{row.peopleReached}</td>
                      <td className="px-2 py-2">{row.leadsGenerated}</td>
                      <td className="px-2 py-2">{row.referralsGenerated}</td>
                      <td className="px-2 py-2">{outcomeLabel(row.outcome)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
              <p>
                Page {list.page} · {list.total} record{list.total === 1 ? '' : 's'}
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={page * list.pageSize >= list.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-6 py-8 text-center text-sm text-slate-500">No activities match these filters.</p>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
    </div>
  )
}

function GroupTable({
  title,
  rows,
  showOutcomes,
}: {
  title: string
  rows: MarketingGroupRow[]
  showOutcomes?: boolean
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h4 className="font-semibold text-slate-900">{title}</h4>
      {rows.length ? (
        <table className="mt-3 min-w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-slate-500">
              <th className="py-1">Name</th>
              <th className="py-1">Activities</th>
              {showOutcomes ? <th className="py-1">Leads</th> : null}
              {showOutcomes ? <th className="py-1">Referrals</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 12).map((row) => (
              <tr key={row.key} className="border-t border-slate-100">
                <td className="py-1.5">{row.label}</td>
                <td className="py-1.5">{row.activities}</td>
                {showOutcomes ? <td className="py-1.5">{row.leads ?? 0}</td> : null}
                {showOutcomes ? <td className="py-1.5">{row.referrals ?? 0}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No rows for this breakdown.</p>
      )}
    </section>
  )
}
