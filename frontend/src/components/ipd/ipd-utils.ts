export type IpdClinicalStatus =
  | 'stable'
  | 'review_due'
  | 'pending_investigation'
  | 'critical'
  | 'discharge_planned'
  | 'available'

export const ipdStatusStyles: Record<IpdClinicalStatus, string> = {
  stable: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  review_due: 'bg-amber-50 text-amber-900 border-amber-200',
  pending_investigation: 'bg-orange-50 text-orange-900 border-orange-200',
  critical: 'bg-red-50 text-red-900 border-red-200',
  discharge_planned: 'bg-sky-50 text-sky-900 border-sky-200',
  available: 'bg-slate-50 text-slate-600 border-slate-200',
}

export const ipdStatusLabels: Record<IpdClinicalStatus, string> = {
  stable: 'Stable',
  review_due: 'Review Due',
  pending_investigation: 'Lab Pending',
  critical: 'Critical',
  discharge_planned: 'Discharge Planned',
  available: 'Available',
}

export const bedStatusStyles: Record<string, string> = {
  occupied: 'border-l-red-500 bg-red-50/40',
  available: 'border-l-emerald-500 bg-emerald-50/30',
  reserved: 'border-l-sky-500 bg-sky-50/30',
  cleaning: 'border-l-violet-500 bg-violet-50/30',
  maintenance: 'border-l-slate-400 bg-slate-50',
}

export const bedCardStyles: Record<string, string> = {
  occupied: 'border-slate-200 bg-white',
  available: 'border-emerald-200 bg-emerald-50/40',
  reserved: 'border-sky-300 bg-sky-50/60',
  cleaning: 'border-violet-300 bg-violet-50/50',
  maintenance: 'border-slate-300 bg-slate-50',
}

export function calcLosDays(admittedAt: string | Date): number {
  const start = new Date(admittedAt).getTime()
  return Math.max(1, Math.ceil((Date.now() - start) / (24 * 60 * 60 * 1000)))
}

export function wardTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    general: 'General Ward',
    icu: 'ICU',
    hdu: 'HDU',
    maternity: 'Maternity Ward',
    paediatric: 'Pediatric Ward',
    surgical: 'Surgical Ward',
    medical: 'Medical Ward',
    isolation: 'Isolation Ward',
  }
  return labels[type] ?? type
}
