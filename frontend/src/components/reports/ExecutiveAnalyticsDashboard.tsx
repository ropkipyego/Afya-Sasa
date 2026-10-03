import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BedDouble,
  CalendarRange,
  Download,
  FlaskConical,
  Minus,
  ScanLine,
  Settings2,
  Users,
} from 'lucide-react'
import { Alert, Button, Card, PageHeader } from '../ui'
import { apiRequest, formatApiError } from '../../lib/api'
import { formatKes } from '../../lib/clinical-catalog'

type DailyPoint = { date: string; count: number }
type Comparison = { current: number; previous: number; delta: number; percent: number | null }

type AnalyticsData = {
  generatedAt: string
  range: { from: string; to: string; days: number }
  comparisonRange: { from: string; to: string }
  summary: {
    opdVisits: number
    newPatients: number
    admissions: number
    discharges: number
    labRequests: number
    radiologyRequests: number
    emergencyCases: number
    appointments: number
    surgeries: number
    referrals: number
    avgDailyOpd: number
    occupiedBeds: number
    totalBeds: number
    currentInpatients?: number
    charges?: number | null
    collections?: number | null
    outstanding?: number | null
    accommodationCharges?: number | null
    bedOccupancyPercent: number | null
  }
  comparison: Record<string, Comparison>
  trends: Record<string, DailyPoint[]>
  breakdowns: Record<string, Record<string, number>>
  financeVisible?: boolean
  chargesEnabled?: boolean
  accountingIntegration?: 'pending' | string
  attention?: {
    unassignedOpd: number
    waitingForDoctor: number
    pendingLabVerification: number
    pendingRadiologyReports: number
    pendingDischarge: number | null
    bedConflicts: number | null
    biometricDeviceStatus: string
    failedIntegrations: number | null
    notificationFailures: number | null
  }
}

type IntelligenceData = {
  generatedAt: string
  range: { from: string; to: string }
  readOnly: boolean
  findings: Array<{
    title: string
    detail: string
    metric: string
    current: number
    baseline: number
    period: string
    source: string
    severity: 'info' | 'watch'
  }>
}

type DashboardConfig = {
  showOpd: boolean
  showPatients: boolean
  showInpatient: boolean
  showLabs: boolean
  showRadiology: boolean
  showEmergency: boolean
  showBreakdowns: boolean
}

const CONFIG_KEY = 'afyasasa-executive-dashboard-config'

const presets = [
  { id: 'today', label: 'Today', mode: 'today' },
  { id: 'yesterday', label: 'Yesterday', mode: 'yesterday' },
  { id: 'week', label: 'This week', mode: 'week' },
  { id: 'month', label: 'This month', mode: 'month' },
  { id: '7d', label: '7 days', mode: 'days', days: 7 },
  { id: '30d', label: '30 days', mode: 'days', days: 30 },
] as const

function defaultConfig(): DashboardConfig {
  return {
    showOpd: true,
    showPatients: true,
    showInpatient: true,
    showLabs: true,
    showRadiology: true,
    showEmergency: true,
    showBreakdowns: true,
  }
}

function loadConfig(): DashboardConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return defaultConfig()
    return { ...defaultConfig(), ...JSON.parse(raw) }
  } catch {
    return defaultConfig()
  }
}

function isoDaysAgo(days: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - (days - 1))
  return date.toISOString().slice(0, 10)
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function startOfUtcWeek(date = new Date()) {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const weekday = copy.getUTCDay() || 7
  copy.setUTCDate(copy.getUTCDate() - (weekday - 1))
  return copy.toISOString().slice(0, 10)
}

function startOfUtcMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10)
}

function yesterdayIso() {
  return isoDaysAgo(2)
}

function DeltaBadge({ comparison }: { comparison?: Comparison }) {
  if (!comparison) return null
  const { delta, percent } = comparison
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
        <Minus className="h-3 w-3" />
        vs prior period
      </span>
    )
  }
  const up = delta > 0
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${
        up ? 'text-emerald-700' : 'text-rose-700'
      }`}
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {percent !== null ? `${percent > 0 ? '+' : ''}${percent}%` : `${delta > 0 ? '+' : ''}${delta}`}
      <span className="text-slate-500">vs prior</span>
    </span>
  )
}

function TrendChart({
  title,
  series,
  tone,
}: {
  title: string
  series: DailyPoint[]
  tone: string
}) {
  const max = Math.max(...series.map((point) => point.count), 1)
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        <span className="text-xs text-slate-500">{series.length} days</span>
      </div>
      <div className="flex h-28 items-end gap-0.5">
        {series.map((point) => (
          <div
            key={point.date}
            className="group relative min-w-0 flex-1"
            title={`${point.date}: ${point.count}`}
          >
            <div
              className={`mx-auto w-full max-w-3 rounded-t ${tone}`}
              style={{ height: `${Math.max(4, (point.count / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-slate-400">
        <span>{series[0]?.date ?? '—'}</span>
        <span>{series[series.length - 1]?.date ?? '—'}</span>
      </div>
    </div>
  )
}

function BreakdownTable({ title, rows }: { title: string; rows: Record<string, number> }) {
  const entries = Object.entries(rows).sort((a, b) => b[1] - a[1])
  const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      <ul className="mt-3 space-y-2">
        {entries.map(([label, value]) => (
          <li key={label}>
            <div className="flex items-center justify-between text-sm">
              <span className="capitalize text-slate-700">{label.replace(/_/g, ' ')}</span>
              <span className="font-semibold tabular-nums">{value}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-teal-500"
                style={{ width: `${(value / total) * 100}%` }}
              />
            </div>
          </li>
        ))}
        {!entries.length ? <li className="text-sm text-slate-500">No data in range</li> : null}
      </ul>
    </div>
  )
}

function AttentionLink({
  label,
  value,
  href,
}: {
  label: string
  value: number | null
  href: string
}) {
  return (
    <button
      type="button"
      className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-left"
      onClick={() => window.dispatchEvent(new CustomEvent('afyasasa:navigate', { detail: href }))}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
        {value == null ? 'Data unavailable' : value}
      </p>
      <p className="mt-1 text-xs text-teal-700">Open {href}</p>
    </button>
  )
}

function KpiCard({
  label,
  value,
  icon: Icon,
  comparison,
  suffix,
  unavailable,
}: {
  label: string
  value: number | string
  icon: typeof Activity
  comparison?: Comparison | null
  suffix?: string
  unavailable?: boolean
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <Icon className="h-5 w-5 text-teal-700" />
        {!unavailable && comparison ? <DeltaBadge comparison={comparison} /> : null}
      </div>
      <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">
        {unavailable ? (
          <span className="text-lg font-semibold text-slate-500">Data unavailable</span>
        ) : (
          <>
            {value}
            {suffix ? <span className="text-lg font-semibold">{suffix}</span> : null}
          </>
        )}
      </p>
    </div>
  )
}

export function ExecutiveAnalyticsDashboard() {
  const [presetId, setPresetId] = useState<string>('month')
  const [from, setFrom] = useState(startOfUtcMonth())
  const [to, setTo] = useState(todayIso())
  const [configOpen, setConfigOpen] = useState(false)
  const [config, setConfig] = useState<DashboardConfig>(loadConfig)

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['executive-analytics', from, to],
    queryFn: () =>
      apiRequest<AnalyticsData>(`/reports/executive-analytics?from=${from}&to=${to}`),
    staleTime: 20_000,
  })
  const { data: intelligence } = useQuery({
    queryKey: ['executive-intelligence', from, to],
    queryFn: () =>
      apiRequest<IntelligenceData>(`/reports/intelligence?from=${from}&to=${to}`),
    staleTime: 20_000,
  })

  const applyPreset = (preset: (typeof presets)[number]) => {
    setPresetId(preset.id)
    if (preset.mode === 'today') {
      setFrom(todayIso())
      setTo(todayIso())
      return
    }
    if (preset.mode === 'yesterday') {
      const yesterday = yesterdayIso()
      setFrom(yesterday)
      setTo(yesterday)
      return
    }
    if (preset.mode === 'week') {
      setFrom(startOfUtcWeek())
      setTo(todayIso())
      return
    }
    if (preset.mode === 'month') {
      setFrom(startOfUtcMonth())
      setTo(todayIso())
      return
    }
    setFrom(isoDaysAgo(preset.days))
    setTo(todayIso())
  }

  const saveConfig = (next: DashboardConfig) => {
    setConfig(next)
    localStorage.setItem(CONFIG_KEY, JSON.stringify(next))
  }

  const exportCsv = () => {
    if (!data) return
    const lines = [
      ['metric', 'value'],
      ...Object.entries(data.summary).map(([key, value]) => [key, value]),
      [],
      ['date', 'opd', 'patients', 'labs', 'radiology', 'emergency'],
      ...data.trends.opdVisits.map((point, index) => [
        point.date,
        point.count,
        data.trends.newPatients[index]?.count ?? 0,
        data.trends.labRequests[index]?.count ?? 0,
        data.trends.radiologyRequests[index]?.count ?? 0,
        data.trends.emergencyCases[index]?.count ?? 0,
      ]),
    ]
    const csv = lines.map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `executive-analytics-${from}-to-${to}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 p-8 text-white">
        <PageHeader
          title="Director dashboard"
          description="Read-only hospital overview from live clinical and operational tables. Payments are not called revenue. QuickBooks remains the accounting system."
        />
        <p className="mt-2 text-xs text-slate-300">
          Comparing {data?.range.from ?? from} → {data?.range.to ?? to}
          {data ? ` (${data.range.days} days)` : ''}
          {data?.comparisonRange
            ? ` · Prior: ${data.comparisonRange.from} → ${data.comparisonRange.to}`
            : ''}
        </p>
      </Card>

      <Card className="p-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Quick range</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {presets.map((preset) => (
                <Button
                  key={preset.id}
                  type="button"
                  variant={presetId === preset.id ? 'primary' : 'secondary'}
                  className="text-xs"
                  onClick={() => applyPreset(preset)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
          <label className="text-sm">
            <span className="font-semibold text-slate-700">From</span>
            <input
              type="date"
              className="input mt-1 block"
              value={from}
              onChange={(e) => {
                setPresetId('custom')
                setFrom(e.target.value)
              }}
            />
          </label>
          <label className="text-sm">
            <span className="font-semibold text-slate-700">To</span>
            <input
              type="date"
              className="input mt-1 block"
              value={to}
              onChange={(e) => {
                setPresetId('custom')
                setTo(e.target.value)
              }}
            />
          </label>
          <Button type="button" onClick={() => refetch()} loading={isFetching}>
            <CalendarRange className="h-4 w-4" />
            Apply range
          </Button>
          <Button type="button" variant="secondary" onClick={exportCsv} disabled={!data}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button type="button" variant="ghost" onClick={() => setConfigOpen((v) => !v)}>
            <Settings2 className="h-4 w-4" />
            Dashboard config
          </Button>
        </div>

        {configOpen ? (
          <div className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ['showOpd', 'OPD & outpatient trends'],
                ['showPatients', 'New patient registrations'],
                ['showInpatient', 'Admissions & discharges'],
                ['showLabs', 'Laboratory volume'],
                ['showRadiology', 'Radiology volume'],
                ['showEmergency', 'Emergency department'],
                ['showBreakdowns', 'Status & ward breakdowns'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={config[key]}
                  onChange={(e) => saveConfig({ ...config, [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
        ) : null}
      </Card>

      {error ? (
        <Alert tone="error">
          <p className="font-semibold">Unable to load the Director dashboard.</p>
          <p>{formatApiError(error, 'The server did not complete the request.')}</p>
          <Button type="button" variant="secondary" className="mt-3" onClick={() => refetch()}>
            Retry
          </Button>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 animate-skeleton rounded-2xl" />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {config.showOpd ? (
              <KpiCard
                label="OPD visits"
                value={data.summary.opdVisits}
                icon={Users}
                comparison={data.comparison.opdVisits}
              />
            ) : null}
            {config.showPatients ? (
              <KpiCard
                label="New patients"
                value={data.summary.newPatients}
                icon={Users}
                comparison={data.comparison.newPatients}
              />
            ) : null}
            {config.showInpatient ? (
              <>
                <KpiCard
                  label="Admissions"
                  value={data.summary.admissions}
                  icon={BedDouble}
                  comparison={data.comparison.admissions}
                />
                <KpiCard
                  label="Discharges"
                  value={data.summary.discharges}
                  icon={BedDouble}
                  comparison={data.comparison.discharges}
                />
                <KpiCard
                  label="Current inpatients"
                  value={data.summary.currentInpatients ?? 0}
                  icon={BedDouble}
                />
                <KpiCard
                  label="Bed occupancy"
                  value={data.summary.bedOccupancyPercent ?? 0}
                  suffix="%"
                  icon={BedDouble}
                  unavailable={
                    data.summary.bedOccupancyPercent == null || data.summary.totalBeds === 0
                  }
                />
              </>
            ) : null}
            {config.showLabs ? (
              <KpiCard
                label="Lab requests"
                value={data.summary.labRequests}
                icon={FlaskConical}
                comparison={data.comparison.labRequests}
              />
            ) : null}
            {config.showRadiology ? (
              <KpiCard
                label="Radiology requests"
                value={data.summary.radiologyRequests}
                icon={ScanLine}
                comparison={data.comparison.radiologyRequests}
              />
            ) : null}
            {config.showEmergency ? (
              <KpiCard
                label="Emergency cases"
                value={data.summary.emergencyCases}
                icon={Activity}
                comparison={data.comparison.emergencyCases}
              />
            ) : null}
            <KpiCard label="Avg daily OPD" value={data.summary.avgDailyOpd} icon={Activity} />
            <KpiCard label="Appointments" value={data.summary.appointments} icon={CalendarRange} />
          </div>

          <Card className="space-y-3 p-5">
            <h3 className="text-sm font-bold text-slate-800">Finance snapshot</h3>
            <p className="text-xs text-slate-500">
              Charges are posted amounts. Payments received are collections. Outstanding is unpaid
              charge balance. These are not a general ledger. Accounting integration pending.
            </p>
            {data.financeVisible === false ? (
              <Alert tone="info">You do not have permission to view financial totals.</Alert>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  label="Charges generated"
                  value={formatKes(data.summary.charges ?? 0)}
                  icon={Activity}
                  comparison={data.comparison.charges}
                  unavailable={data.chargesEnabled === false}
                />
                <KpiCard
                  label="Payments received"
                  value={formatKes(data.summary.collections ?? 0)}
                  icon={Activity}
                  comparison={data.comparison.collections}
                />
                <KpiCard
                  label="Outstanding balances"
                  value={formatKes(data.summary.outstanding ?? 0)}
                  icon={Activity}
                  comparison={data.comparison.outstanding}
                  unavailable={data.chargesEnabled === false}
                />
                <KpiCard
                  label="Accommodation charges"
                  value={formatKes(data.summary.accommodationCharges ?? 0)}
                  icon={BedDouble}
                  unavailable={data.chargesEnabled === false}
                />
              </div>
            )}
          </Card>

          {data.attention ? (
            <Card className="space-y-3 p-5">
              <h3 className="text-sm font-bold text-slate-800">Operational attention</h3>
              <p className="text-xs text-slate-500">
                Live counts from canonical tables. Zero means the database currently has none.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <AttentionLink
                  label="Unassigned OPD encounters"
                  value={data.attention.unassignedOpd}
                  href="Doctor Queue"
                />
                <AttentionLink
                  label="Patients waiting for doctor"
                  value={data.attention.waitingForDoctor}
                  href="Doctor Queue"
                />
                <AttentionLink
                  label="Pending lab verification"
                  value={data.attention.pendingLabVerification}
                  href="Laboratory"
                />
                <AttentionLink
                  label="Pending radiology reports"
                  value={data.attention.pendingRadiologyReports}
                  href="Radiology"
                />
                <AttentionLink
                  label="Pending discharge summaries"
                  value={data.attention.pendingDischarge}
                  href="Inpatient (IPD)"
                />
                <AttentionLink
                  label="Bed assignment conflicts"
                  value={data.attention.bedConflicts}
                  href="Inpatient (IPD)"
                />
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Biometric device
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {data.attention.biometricDeviceStatus}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Failed integrations
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {data.attention.failedIntegrations == null
                      ? 'Data unavailable'
                      : data.attention.failedIntegrations}
                  </p>
                </div>
              </div>
            </Card>
          ) : null}

          {intelligence?.findings?.length ? (
            <Card className="space-y-3 p-5">
              <h3 className="text-sm font-bold text-slate-800">Read-only intelligence</h3>
              <p className="text-xs text-slate-500">
                Deterministic comparison against the prior period. These findings never create or change charges, payments, or records.
              </p>
              {intelligence.findings.map((finding) => (
                <Alert key={finding.title} tone={finding.severity === 'watch' ? 'warning' : 'info'}>
                  <p className="font-semibold">{finding.title}</p>
                  <p>{finding.detail}</p>
                  <p className="mt-1 text-xs">Source: {finding.source} · {finding.period}</p>
                </Alert>
              ))}
            </Card>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            {data.trends.charges?.length || data.trends.collections?.length ? (
              <TrendChart
                title="Charges vs collections"
                series={data.trends.charges ?? []}
                tone="bg-amber-500"
              />
            ) : null}
            {data.trends.collections?.length ? (
              <TrendChart
                title="Collections per day"
                series={data.trends.collections}
                tone="bg-emerald-500"
              />
            ) : null}
            {config.showOpd ? (
              <TrendChart
                title="OPD visits per day"
                series={data.trends.opdVisits}
                tone="bg-sky-500"
              />
            ) : null}
            {config.showPatients ? (
              <TrendChart
                title="New patient registrations"
                series={data.trends.newPatients}
                tone="bg-emerald-500"
              />
            ) : null}
            {config.showInpatient ? (
              <>
                <TrendChart
                  title="Admissions per day"
                  series={data.trends.admissions}
                  tone="bg-violet-500"
                />
                <TrendChart
                  title="Discharges per day"
                  series={data.trends.discharges}
                  tone="bg-indigo-500"
                />
              </>
            ) : null}
            {config.showLabs ? (
              <TrendChart
                title="Laboratory requests"
                series={data.trends.labRequests}
                tone="bg-blue-500"
              />
            ) : null}
            {config.showRadiology ? (
              <TrendChart
                title="Radiology requests"
                series={data.trends.radiologyRequests}
                tone="bg-teal-500"
              />
            ) : null}
            {config.showEmergency ? (
              <TrendChart
                title="Emergency presentations"
                series={data.trends.emergencyCases}
                tone="bg-rose-500"
              />
            ) : null}
          </div>

          {config.showBreakdowns ? (
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              <BreakdownTable title="OPD by visit type" rows={data.breakdowns.opdByVisitType} />
              <BreakdownTable title="Lab by status" rows={data.breakdowns.labByStatus} />
              <BreakdownTable title="Radiology by status" rows={data.breakdowns.radiologyByStatus} />
              <BreakdownTable title="Radiology by priority" rows={data.breakdowns.radiologyByPriority} />
              <BreakdownTable title="Admissions by ward" rows={data.breakdowns.admissionsByWard} />
              <BreakdownTable title="ED by triage" rows={data.breakdowns.emergencyByTriage} />
              {data.breakdowns.chargesByServiceLine ? (
                <BreakdownTable title="Charges by department" rows={data.breakdowns.chargesByServiceLine} />
              ) : null}
              {data.breakdowns.collectionsByMethod ? (
                <BreakdownTable title="Collections by method" rows={data.breakdowns.collectionsByMethod} />
              ) : null}
              {data.breakdowns.outstandingAgeing ? (
                <BreakdownTable title="Outstanding ageing" rows={data.breakdowns.outstandingAgeing} />
              ) : null}
            </div>
          ) : null}

          <p className="text-xs text-slate-500">
            Last updated: {new Date(data.generatedAt).toLocaleString()}
          </p>
        </>
      ) : null}
    </div>
  )
}
