export type ReportFormat = 'csv' | 'pdf' | 'xlsx'

export type ReportDefinition = {
  key: string
  title: string
  description: string
  formats: ReportFormat[]
}

export const reportLibrary: ReportDefinition[] = [
  { key: 'opd-summary', title: 'Daily OPD Report', description: 'Visits, status, and visit types', formats: ['csv', 'pdf', 'xlsx'] },
  { key: 'admissions', title: 'Admissions Report', description: 'Active and recent admissions', formats: ['csv', 'pdf', 'xlsx'] },
  { key: 'discharges', title: 'Discharges Report', description: 'Completed discharges', formats: ['csv', 'pdf', 'xlsx'] },
  { key: 'bed-occupancy', title: 'Bed Occupancy Report', description: 'Ward and bed utilisation', formats: ['csv', 'pdf', 'xlsx'] },
  { key: 'emergency-stats', title: 'Emergency Stats', description: 'Emergency department activity', formats: ['csv', 'pdf'] },
  { key: 'disease-register', title: 'Disease Burden Report', description: 'Diagnosis register', formats: ['csv', 'pdf', 'xlsx'] },
  { key: 'moh-705', title: 'MOH 705 Draft', description: 'Outpatient morbidity summary', formats: ['csv', 'pdf'] },
  { key: 'laboratory', title: 'Laboratory Activity', description: 'Lab request volumes by status', formats: ['csv', 'pdf'] },
  { key: 'theatre', title: 'Theatre Report', description: 'Surgical bookings by status', formats: ['csv', 'pdf'] },
  { key: 'maternity', title: 'Maternity Report', description: 'Pregnancy registry summary', formats: ['csv', 'pdf'] },
  { key: 'referrals', title: 'Referral Report', description: 'Internal and external referrals', formats: ['csv', 'pdf'] },
  { key: 'icu', title: 'ICU / HDU Report', description: 'Critical care census', formats: ['csv', 'pdf'] },
]

/** @deprecated all reports are now in reportLibrary */
export const upcomingReports: ReportDefinition[] = []
export const upcomingReportKeys = new Set<string>()

export interface ReportExporter {
  format: ReportFormat
  mimeType: string
  extension: string
  export(reportKey: string, payload: { csv?: string; data?: unknown; generatedAt?: string }): Blob
}

class CsvExporter implements ReportExporter {
  format = 'csv' as const
  mimeType = 'text/csv;charset=utf-8'
  extension = 'csv'

  export(_reportKey: string, payload: { csv?: string }) {
    return new Blob([payload.csv ?? ''], { type: this.mimeType })
  }
}

class PdfExporter implements ReportExporter {
  format = 'pdf' as const
  mimeType = 'text/html;charset=utf-8'
  extension = 'html'

  export(reportKey: string, payload: { data?: unknown; generatedAt?: string; csv?: string }) {
    const title = reportLibrary.find((r) => r.key === reportKey)?.title ?? reportKey
    const body = payload.csv
      ? `<pre style="font-family:monospace;font-size:11px;white-space:pre-wrap">${escapeHtml(payload.csv)}</pre>`
      : `<pre style="font-family:monospace;font-size:11px">${escapeHtml(JSON.stringify(payload.data, null, 2))}</pre>`
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
      <style>body{font-family:system-ui,sans-serif;padding:2rem;color:#0f172a}h1{color:#0d9488;font-size:1.25rem}
      .meta{color:#64748b;font-size:0.875rem;margin-bottom:1.5rem}</style></head><body>
      <h1>${escapeHtml(title)}</h1>
      <p class="meta">AfyaSasa · Generated ${escapeHtml(payload.generatedAt ?? new Date().toISOString())}</p>
      ${body}</body></html>`
    return new Blob([html], { type: this.mimeType })
  }
}

class ExcelExporter implements ReportExporter {
  format = 'xlsx' as const
  mimeType = 'text/csv;charset=utf-8'
  extension = 'csv'

  export(reportKey: string, payload: { csv?: string; generatedAt?: string }) {
    const header = `# ${reportKey} · ${payload.generatedAt ?? ''}\n`
    return new Blob([header + (payload.csv ?? '')], { type: this.mimeType })
  }
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const exporters: Record<ReportFormat, ReportExporter> = {
  csv: new CsvExporter(),
  pdf: new PdfExporter(),
  xlsx: new ExcelExporter(),
}

export function downloadReport(
  reportKey: string,
  format: ReportFormat,
  payload: { csv?: string; data?: unknown; generatedAt?: string },
) {
  const exporter = exporters[format]
  const blob = exporter.export(reportKey, payload)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${reportKey}.${exporter.extension}`
  link.click()
  URL.revokeObjectURL(url)
}

export function availableFormats(reportKey: string): ReportFormat[] {
  return reportLibrary.find((item) => item.key === reportKey)?.formats ?? ['csv']
}
