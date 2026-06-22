export type CatalogOption = { value: string; label: string }

export type ClinicalCatalog = {
  clinics: string[]
  visitTypes: CatalogOption[]
  doctorCategories: string[]
  assignableDoctors: string[]
  paymentMethods: CatalogOption[]
}

export const defaultClinicalCatalog: ClinicalCatalog = {
  clinics: [
    'General OPD',
    'Cardiology',
    'Orthopaedic',
    'Paediatrics',
    'ENT',
    'Dermatology',
    'Gynaecology',
    'Maternity',
  ],
  visitTypes: [
    { value: 'new', label: 'New visit' },
    { value: 'follow_up', label: 'Follow-up' },
    { value: 'referral', label: 'Referral' },
  ],
  doctorCategories: ['Consultant', 'Medical Officer', 'Clinical Officer', 'Specialist'],
  assignableDoctors: [],
  paymentMethods: [
    { value: 'cash', label: 'Cash' },
    { value: 'mpesa', label: 'M-Pesa' },
    { value: 'card', label: 'Card' },
    { value: 'insurance', label: 'Insurance' },
    { value: 'quickbooks', label: 'QuickBooks receipt' },
    { value: 'waived', label: 'Waived' },
  ],
}

export function normalizeClinicalCatalog(raw?: Partial<ClinicalCatalog> | null): ClinicalCatalog {
  return {
    clinics: raw?.clinics?.length ? raw.clinics : defaultClinicalCatalog.clinics,
    visitTypes: raw?.visitTypes?.length ? raw.visitTypes : defaultClinicalCatalog.visitTypes,
    doctorCategories: raw?.doctorCategories?.length
      ? raw.doctorCategories
      : defaultClinicalCatalog.doctorCategories,
    assignableDoctors: raw?.assignableDoctors ?? defaultClinicalCatalog.assignableDoctors,
    paymentMethods: raw?.paymentMethods?.length
      ? raw.paymentMethods
      : defaultClinicalCatalog.paymentMethods,
  }
}

export const identifierLabels: Record<string, string> = {
  national_id: 'National ID number',
  sha: 'SHA number',
  passport: 'Passport number',
  birth_certificate: 'Birth certificate number',
  refugee_id: 'Refugee ID number',
}

export function identifierFieldLabel(type: string) {
  return identifierLabels[type] ?? 'Document number'
}
