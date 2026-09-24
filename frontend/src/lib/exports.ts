import { useAuthStore } from './auth-store'
import { ApiRequestError } from './api'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

export const DEPARTMENT_EXPORTS = [
  { dataset: 'opd', label: 'OPD visits', permission: 'encounters:read' },
  { dataset: 'laboratory', label: 'Laboratory', permission: 'lab_requests:read' },
  { dataset: 'radiology', label: 'Radiology', permission: 'radiology_requests:read' },
  { dataset: 'pharmacy', label: 'Pharmacy', permission: 'pharmacy:read' },
  { dataset: 'ipd', label: 'IPD admissions', permission: 'admissions:read' },
  { dataset: 'emergency', label: 'Emergency', permission: 'emergency:read' },
  { dataset: 'finance', label: 'Finance', permission: 'payments:read' },
  { dataset: 'theatre', label: 'Theatre', permission: 'surgery_bookings:read' },
  { dataset: 'maternity', label: 'Maternity', permission: 'pregnancies:read' },
  { dataset: 'icu', label: 'ICU', permission: 'icu_admissions:read' },
  { dataset: 'hdu', label: 'HDU', permission: 'hdu_admissions:read' },
  { dataset: 'nursing', label: 'Nursing vitals', permission: 'vitals:read' },
] as const

export async function downloadDepartmentExport(params: {
  dataset: string
  format: 'csv' | 'xlsx'
  from?: string
  to?: string
  status?: string
}) {
  const { tenant, accessToken } = useAuthStore.getState()
  const query = new URLSearchParams({ format: params.format })
  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)
  if (params.status) query.set('status', params.status)
  const response = await fetch(`${API_BASE}/exports/${params.dataset}?${query.toString()}`, {
    credentials: 'include',
    headers: {
      'X-Tenant': tenant,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw new ApiRequestError(
      typeof error.message === 'string' ? error.message : 'Export failed',
      response.status,
    )
  }
  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const match = disposition.match(/filename="([^"]+)"/)
  const filename = match?.[1] ?? `${params.dataset}.${params.format}`
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
