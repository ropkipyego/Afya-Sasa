import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { availableFormats, downloadReport, reportLibrary } from '../../lib/report-exporters'
import { apiRequest } from '../../lib/api'

interface ReportPayload {
  generatedAt: string
  data: unknown
  csv: string
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

export function ClinicalReportsDashboard() {
  const [selectedReport, setSelectedReport] = useState('opd-summary')
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf' | 'xlsx'>('csv')

  const { data: dashboard } = useQuery({
    queryKey: ['reports-dashboard'],
    queryFn: () =>
      apiRequest<{
        totalPatients: number
        activeOpd: number
        activeAdmissions: number
        occupiedBeds: number
        activeEmergency: number
        activeAlerts: number
        todayAppointments: number
      }>('/reports/dashboard'),
  })

  const { data: report, isFetching } = useQuery({
    queryKey: ['clinical-report', selectedReport],
    queryFn: () => apiRequest<ReportPayload>(`/reports/${selectedReport}`),
  })

  const activeDefinition = reportLibrary.find((item) => item.key === selectedReport)
  const formats = availableFormats(selectedReport)

  function handleExport() {
    if (!report) return
    downloadReport(selectedReport, exportFormat, {
      csv: report.csv,
      data: report.data,
      generatedAt: report.generatedAt,
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Patients" value={dashboard?.totalPatients ?? 0} />
        <MetricCard label="Active OPD" value={dashboard?.activeOpd ?? 0} />
        <MetricCard label="Admissions" value={dashboard?.activeAdmissions ?? 0} />
        <MetricCard label="Occupied beds" value={dashboard?.occupiedBeds ?? 0} />
        <MetricCard label="Emergency" value={dashboard?.activeEmergency ?? 0} />
        <MetricCard label="Alerts" value={dashboard?.activeAlerts ?? 0} />
        <MetricCard label="Appointments today" value={dashboard?.todayAppointments ?? 0} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.35fr_0.65fr]">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h3 className="text-xl font-bold">Report library</h3>
          <div className="mt-4 space-y-2">
            {reportLibrary.map((definition) => (
              <button
                key={definition.key}
                type="button"
                className={`w-full rounded-xl px-4 py-3 text-left text-sm ${
                  selectedReport === definition.key
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
                onClick={() => {
                  setSelectedReport(definition.key)
                  setExportFormat('csv')
                }}
              >
                <p className="font-semibold">{definition.title}</p>
                <p
                  className={`mt-0.5 text-xs ${
                    selectedReport === definition.key ? 'text-teal-100' : 'text-slate-500'
                  }`}
                >
                  {definition.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Generated {report?.generatedAt ?? '—'}</p>
              <h3 className="text-xl font-bold">{activeDefinition?.title ?? selectedReport}</h3>
              <p className="text-sm text-slate-500">{activeDefinition?.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {formats.map((format) => (
                <button
                  key={format}
                  type="button"
                  className={`rounded-xl px-3 py-2 text-xs font-bold uppercase ${
                    exportFormat === format ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                  onClick={() => setExportFormat(format)}
                >
                  {format}
                </button>
              ))}
              <button
                type="button"
                className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white disabled:bg-slate-300"
                onClick={handleExport}
                disabled={!report || isFetching}
              >
                Export {exportFormat.toUpperCase()}
              </button>
            </div>
          </div>
          <pre className="mt-4 max-h-[32rem] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-50">
            {isFetching ? 'Loading…' : JSON.stringify(report?.data, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}
