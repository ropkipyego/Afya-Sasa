import type { HospitalProfile } from './clinical-catalog'
import { useAuthStore } from './auth-store'

export type TemplateVariables = Record<string, string | number | undefined | null>

export type PrintTemplate = {
  key?: string
  name: string
  html?: string
  docxStoragePath?: string
  docxFilename?: string
}

const baseStyles = `
body{font-family:system-ui,sans-serif;padding:48px;max-width:720px;margin:0 auto;line-height:1.6;color:#0f172a}
.header{text-align:center;border-bottom:2px solid {{primaryColor}};padding-bottom:16px;margin-bottom:32px}
.header h1{color:{{primaryColor}};margin:0 0 8px;font-size:1.35rem}
.stamp{margin-top:48px;display:flex;justify-content:space-between;gap:16px}
.box{border:1px dashed #94a3b8;min-width:140px;height:72px;text-align:center;padding-top:26px;color:#64748b;font-size:11px}
.footer{margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b}
.meta{color:#64748b;font-size:13px;margin-bottom:24px}
.letter{white-space:pre-wrap;line-height:1.6}
`

export const defaultPrintTemplates: Record<string, PrintTemplate> = {
  sick_sheet: {
    key: 'sick_sheet',
    name: 'Sick sheet / medical certificate',
    html: `<!DOCTYPE html><html><head><title>Sick Sheet</title><style>${baseStyles}</style></head><body>
<div class="header"><h1>{{facilityName}}</h1><p>Medical Certificate / Sick Sheet</p></div>
<p><strong>Patient:</strong> {{patientName}} ({{patientNo}})</p>
<p><strong>Diagnosis:</strong> {{diagnosis}}</p>
<p><strong>Period of incapacity:</strong> {{startDate}} to {{endDate}} ({{daysOff}} days)</p>
<p>This is to certify that the above-named patient is unfit for work/school during the stated period.</p>
<div class="stamp">
<div><p><strong>Doctor:</strong> {{doctorName}}</p><p><strong>License No:</strong> {{licenseNumber}}</p><p>Date: {{issuedDate}}</p></div>
<div class="box">Hospital stamp</div><div class="box">Signature</div>
</div>
<p class="footer">{{footerText}}</p>
</body></html>`,
  },
  referral_letter: {
    key: 'referral_letter',
    name: 'Referral letter',
    html: `<!DOCTYPE html><html><head><title>Referral</title><style>${baseStyles}</style></head><body>
<div class="header"><h1>{{facilityName}}</h1><p>Referral Letter</p></div>
<div class="meta">
Patient: {{patientName}} ({{patientNo}})<br/>
Type: {{referralType}} · Status: {{referralStatus}}<br/>
{{targetDepartmentLine}}{{targetFacilityLine}}
</div>
<p><strong>Reason:</strong> {{reason}}</p>
<div class="letter">{{letterBody}}</div>
<p class="footer">{{footerText}}</p>
</body></html>`,
  },
  patient_card: {
    key: 'patient_card',
    name: 'Patient card',
    html: `<!DOCTYPE html><html><head><title>Patient Card</title><style>
body{font-family:system-ui,sans-serif;padding:24px;max-width:400px;margin:0 auto}
.card{border:2px solid #cbd5e1;border-radius:12px;padding:20px}
h1{font-size:1.1rem;color:{{primaryColor}};margin:0}
.row{margin:8px 0;font-size:14px}
</style></head><body>
<div class="card">
<h1>{{facilityName}}</h1>
<p class="row"><strong>{{patientName}}</strong></p>
<p class="row">MRN: {{patientNo}}</p>
<p class="row">DOB: {{dateOfBirth}} · {{gender}}</p>
<p class="row">Phone: {{primaryPhone}}</p>
</div>
</body></html>`,
  },
}

export function interpolateTemplate(template: string, variables: TemplateVariables): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = variables[key]
    if (value === undefined || value === null) return ''
    return String(value)
  })
}

export function hospitalTemplateVars(profile?: Partial<HospitalProfile> | null): TemplateVariables {
  return {
    facilityName: profile?.facilityName ?? 'Hospital',
    primaryColor: profile?.primaryColor ?? '#0d9488',
    footerText: profile?.footerText ?? 'Confidential medical record',
    tagline: profile?.tagline ?? '',
  }
}

export function renderPrintTemplate(
  templateKey: string,
  variables: TemplateVariables,
  overrides?: Record<string, PrintTemplate>,
): string {
  const catalog = overrides ?? {}
  const template = catalog[templateKey] ?? defaultPrintTemplates[templateKey]
  if (!template?.html) {
    throw new Error(`Print template "${templateKey}" has no HTML fallback.`)
  }
  return interpolateTemplate(template.html, variables)
}

async function downloadRenderedDocx(
  templateKey: string,
  variables: Record<string, unknown>,
  filename?: string,
) {
  const { tenant, accessToken } = useAuthStore.getState()
  const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
  const response = await fetch(`${API_BASE}/reports/templates/${templateKey}/render`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant': tenant,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ variables }),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(error.message ?? 'DOCX render failed')
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename ?? `${templateKey}.docx`
  link.click()
  URL.revokeObjectURL(url)
}

export async function printOrDownloadTemplate(
  templateKey: string,
  variables: TemplateVariables,
  overrides?: Record<string, PrintTemplate>,
) {
  const template = overrides?.[templateKey] ?? defaultPrintTemplates[templateKey]
  if (template?.docxStoragePath) {
    await downloadRenderedDocx(
      templateKey,
      variables as Record<string, unknown>,
      template.docxFilename ?? `${templateKey}.docx`,
    )
    return
  }
  printFromTemplate(templateKey, variables, overrides)
}

export function openPrintHtml(html: string, title = 'Document') {
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.title = title
  win.document.close()
  win.focus()
  win.print()
}

export function printFromTemplate(
  templateKey: string,
  variables: TemplateVariables,
  overrides?: Record<string, PrintTemplate>,
) {
  const html = renderPrintTemplate(templateKey, variables, overrides)
  const name = overrides?.[templateKey]?.name ?? defaultPrintTemplates[templateKey]?.name ?? 'Document'
  openPrintHtml(html, name)
}
