import { useMemo, useState } from 'react'
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
import { apiRequest } from '../../lib/api'

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
    bedOccupancyPercent: number
    occupiedBeds: number
    totalBeds: number
  }
  comparison: Record<string, Comparison>
  trends: Record<string, DailyPoint[]>
  breakdowns: Record<string, Record<string, number>>
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
  { id: '7d', label: '7 days', days: 7 },
  { id: '30d', label: '30 days', days: 30 },
  { id: '90d', label: '90 days', days: 90 },
  { id: '180d', label: '6 months', days: 180 },
  { id: '365d', label: '12 months', days: 365 },
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

function KpiCard({
  label,
  value,
  icon: Icon,
  comparison,
  suffix,
}: {
  label: string
  value: number | string
  icon: typeof Activity
  comparison?: Comparison
  suffix?: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <Icon className="h-5 w-5 text-teal-700" />
        <DeltaBadge comparison={comparison} />
      </div>
      <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">
        {value}
        {suffix ? <span className="text-lg font-semibold">{suffix}</span> : null}
      </p>
    </div>
  )
}

export function ExecutiveAnalyticsDashboard() {
  const [presetDays, setPresetDays] = useState(30)
  const [from, setFrom] = useState(isoDaysAgo(30))
  const [to, setTo] = useState(todayIso())
  const [configOpen, setConfigOpen] = useState(false)
  const [config, setConfig] = useState<DashboardConfig>(loadConfig)

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['executive-analytics', from, to],
    queryFn: () =>
      apiRequest<AnalyticsData>(`/reports/executive-analytics?from=${from}&to=${to}`),
  })

  const applyPreset = (days: number) => {
    setPresetDays(days)
    setFrom(isoDaysAgo(days))
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

  const checklist = useMemo(
    () => [
      { label: 'Date range applied', done: Boolean(from && to) },
      { label: 'KPI summary loaded', done: Boolean(data?.summary) },
      { label: 'Trend series available', done: Boolean(data?.trends?.opdVisits?.length) },
      { label: 'Prior-period comparison', done: Boolean(data?.comparison?.opdVisits) },
      { label: 'Module breakdowns', done: Boolean(data?.breakdowns) },
    ],
    [data, from, to],
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 p-8 text-white">
        <PageHeader
          title="Executive analytics"
          description="BI-style hospital performance — configurable date ranges, trends, and comparisons for directors and medical superintendents."
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
                  variant={presetDays === preset.days ? 'primary' : 'secondary'}
                  className="text-xs"
                  onClick={() => applyPreset(preset.days)}
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
                setPresetDays(0)
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
                setPresetDays(0)
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

      <Card className="p-5">
        <h3 className="text-sm font-bold text-slate-800">Dashboard readiness</h3>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {checklist.map((item) => (
            <li
              key={item.label}
              className={`rounded-lg px-3 py-2 text-sm ${
                item.done ? 'bg-emerald-50 text-emerald-900' : 'bg-slate-50 text-slate-600'
              }`}
            >
              {item.done ? '✓' : '○'} {item.label}
            </li>
          ))}
        </ul>
      </Card>

      {error ? <Alert tone="error">{error.message}</Alert> : null}

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
                  label="Bed occupancy"
                  value={data.summary.bedOccupancyPercent}
                  suffix="%"
                  icon={BedDouble}
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

          <div className="grid gap-4 lg:grid-cols-2">
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
            </div>
          ) : null}

          <p className="text-xs text-slate-500">
            Generated {new Date(data.generatedAt).toLocaleString()}
          </p>
        </>
      ) : null}
    </div>
  )
}
