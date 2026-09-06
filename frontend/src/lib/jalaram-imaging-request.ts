/** Shared constants for the Jalaram St. Christopher Hospital imaging request form. */

export const JALARAM_EXAM_TYPES = [
  { key: 'ct_scan', label: 'CT Scan', matchCodes: ['CT'] },
  { key: 'xray', label: 'X-RAY', matchCodes: ['XRAY', 'X-RAY'] },
  { key: 'ultrasound', label: 'ULTRASOUND', matchCodes: ['US', 'ULTRASOUND'] },
  { key: 'echo', label: 'ECHO', matchCodes: ['ECHO'] },
  { key: 'ecg', label: 'ECG', matchCodes: ['ECG'] },
  { key: 'wellness', label: 'WELLNESS CHECKS', matchCodes: ['WELLNESS'] },
] as const

export const JALARAM_BRAND_PRESET = {
  facilityName: 'Jalaram St. Christopher Hospital',
  tagline: 'Caring Hearts Healing Hands',
  primaryColor: '#1e4d8c',
  accentColor: '#c41e3a',
  contactPhone: '0726100462 — 0726100588',
  contactEmail: 'info@jalaram.co.ke',
  physicalAddress: 'Hyrax, Nakuru–Nairobi Highway, Nakuru, Kenya',
  website: 'www.jalaram.co.ke',
} as const

export type JalaramImagingRequestPrintData = {
  requestNo?: string | null
  requestDate: string
  patientName: string
  patientNo?: string | null
  age: string
  gender: string
  lmp?: string | null
  examTypes: string[]
  requestedInvestigation?: string | null
  urgencyUrgent: boolean
  generalInformation: {
    contrastAllergy: boolean
    kidneyLiverDisease: boolean
    vitallyUnstable: boolean
    requiresOxygen: boolean
  }
  diagnosis: string
  briefHistory: string
  doctorName: string
  facilityName?: string | null
  doctorPhone?: string | null
  branding: {
    facilityName: string
    tagline?: string
    primaryColor: string
    accentColor: string
    logoUrl?: string
    contactPhone?: string
    contactEmail?: string
    address?: string
    website?: string
  }
}

export function examLabelForKey(key: string) {
  return JALARAM_EXAM_TYPES.find((row) => row.key === key)?.label ?? key
}

export function parseStoredRequestFormData(raw: Record<string, unknown> | null | undefined): Partial<JalaramImagingRequestPrintData> | null {
  if (!raw || raw.formTemplate !== 'jalaram_imaging_request_v1') return null
  const general = (raw.generalInformation ?? {}) as Record<string, boolean>
  const snapshot = (raw.patientSnapshot ?? {}) as Record<string, string>
  return {
    requestDate: String(raw.requestDate ?? new Date().toISOString().slice(0, 10)),
    patientName: snapshot.name ?? '',
    patientNo: snapshot.patientNo ?? null,
    age: snapshot.age ?? '—',
    gender: snapshot.gender ?? '—',
    lmp: (raw.lmp as string) ?? null,
    examTypes: Array.isArray(raw.examTypes) ? (raw.examTypes as string[]) : [],
    requestedInvestigation: (raw.requestedInvestigation as string) ?? null,
    urgencyUrgent: Boolean(raw.urgencyUrgent),
    generalInformation: {
      contrastAllergy: Boolean(general.contrastAllergy),
      kidneyLiverDisease: Boolean(general.kidneyLiverDisease),
      vitallyUnstable: Boolean(general.vitallyUnstable),
      requiresOxygen: Boolean(general.requiresOxygen),
    },
    diagnosis: String(raw.diagnosis ?? ''),
    briefHistory: String(raw.briefHistory ?? ''),
    doctorName: String(raw.doctorName ?? ''),
    facilityName: (raw.facilityName as string) ?? null,
    doctorPhone: (raw.doctorPhone as string) ?? null,
  }
}
