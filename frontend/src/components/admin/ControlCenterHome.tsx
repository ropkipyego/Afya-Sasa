import clsx from 'clsx'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '../ui'
import type { ControlCenterSection } from './HospitalControlCenter'
import {
  controlCenterCategories,
  filterControlCenterCards,
} from './control-center-sections'
import { canAccessControlCenterSection } from '../../lib/control-center-permissions'
import { apiRequest } from '../../lib/api'
import { formatKes } from '../../lib/clinical-catalog'

export function ControlCenterHome({
  permissions,
  onOpen,
}: {
  permissions: string[]
  onOpen: (section: Exclude<ControlCenterSection, 'home'>) => void
}) {
  const [query, setQuery] = useState('')

  const canReadOps = permissions.includes('reports:read')
  const { data: ops } = useQuery({
    queryKey: ['operations-dashboard', 'control-center'],
    queryFn: () =>
      apiRequest<{
        patientsToday: number
        admissions: number
        pendingLabs: number
        pendingRadiology: number
        emergencyCases: number
        maternityCases?: number
        theatreCases?: number
        todayAppointments?: number
        totalPatients?: number
        occupancy?: { occupied: number; total: number; percent: number }
        chargesToday?: number
        collectionsToday?: number
        outstanding?: number
        dischargesToday?: number | null
      }>('/reports/operations'),
    enabled: canReadOps,
    refetchInterval: 30_000,
  })
  const { data: chargeJob } = useQuery({
    queryKey: ['accommodation-charge-job', 'control-center'],
    queryFn: () =>
      apiRequest<{
        lastRunAt: string | null
        lastGenerated: number
        lastSkipped: number
        lastMessage: string | null
        unpricedAutomaticItems: Array<{ name: string }>
      }>('/payments/charges/accommodation/job'),
    enabled: canReadOps,
    refetchInterval: 60_000,
  })

  const cards = useMemo(
    () =>
      filterControlCenterCards(query).filter((card) =>
        canAccessControlCenterSection(permissions, card.id),
      ),
    [permissions, query],
  )

  return (
    <div className="space-y-8">
      {canReadOps && ops ? (
        <section>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Today</h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <TodayTile label="Registered patients" value={ops.totalPatients ?? 0} />
            <TodayTile label="OPD visits today" value={ops.patientsToday} />
            <TodayTile label="Active admissions" value={ops.admissions} />
            <TodayTile label="Emergency active" value={ops.emergencyCases} />
            <TodayTile label="Lab pending" value={ops.pendingLabs} />
            <TodayTile label="Radiology pending" value={ops.pendingRadiology} />
            <TodayTile label="Theatre today" value={ops.theatreCases ?? 0} />
            <TodayTile label="Maternity active" value={ops.maternityCases ?? 0} />
            <TodayTile label="Appointments today" value={ops.todayAppointments ?? 0} />
            <TodayTile
              label="Bed occupancy"
              value={ops.occupancy ? `${ops.occupancy.occupied}/${ops.occupancy.total}` : '—'}
            />
            <TodayTile label="Discharges today" value={ops.dischargesToday ?? 0} />
            <TodayTile label="Today's charges" value={formatKes(ops.chargesToday ?? 0)} />
            <TodayTile label="Today's collections" value={formatKes(ops.collectionsToday ?? 0)} />
            <TodayTile label="Outstanding" value={formatKes(ops.outstanding ?? 0)} />
          </div>
          {chargeJob ? (
            <p className="mt-3 text-xs text-slate-500">
              Automatic accommodation: last run{' '}
              {chargeJob.lastRunAt ? new Date(chargeJob.lastRunAt).toLocaleString() : 'not yet'}
              {` · ${chargeJob.lastGenerated} created · ${chargeJob.lastSkipped} skipped`}
              {chargeJob.unpricedAutomaticItems?.length
                ? ` · waiting for rates: ${chargeJob.unpricedAutomaticItems.map((row) => row.name).join(', ')}`
                : ''}
            </p>
          ) : null}
        </section>
      ) : null}
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          className="pl-9"
          placeholder="Search configuration — wards, templates, users…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {controlCenterCategories.map((category) => {
        const categoryCards = cards.filter((card) => card.category === category)
        if (!categoryCards.length) return null
        return (
          <section key={category}>
            <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">
              {category}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {categoryCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => onOpen(card.id)}
                  className={clsx(
                    'card-hover group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition',
                    'hover:border-teal-200 hover:shadow-md',
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className="rounded-xl bg-teal-50 p-3 text-teal-700 group-hover:bg-teal-600 group-hover:text-white">
                      {card.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900">{card.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{card.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )
      })}

      {!cards.length ? (
        <p className="py-16 text-center text-sm text-slate-500">No configuration areas match your search.</p>
      ) : null}
    </div>
  )
}

function TodayTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}
