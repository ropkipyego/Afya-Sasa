export type CatalogOption = { value: string; label: string }

export type StaffClinician = {
  id: string
  firstName: string
  lastName: string
  specialisation?: string | null
  label: string
}

export type HospitalProfile = {
  facilityName: string
  shortName?: string
  mohFacilityCode: string
  licenceNumber: string
  registrationNumber?: string
  facilityLevel?: string
  ownership?: string
  hospitalType?: string
  county?: string
  subCounty?: string
  address: string
  physicalAddress?: string
  postalAddress?: string
  contactPhone: string
  contactEmail: string
  website?: string
  kraPin?: string
  timeZone?: string
  language?: string
  currency?: string
  primaryColor: string
  accentColor?: string
  logoUrl?: string
  faviconUrl?: string
  stampUrl?: string
  sealUrl?: string
  footerText?: string
  tagline?: string
  smsSignature?: string
}

export type FeatureFlags = {
  /** Camera/manual QR patient lookup — disabled until biometric roadmap */
  qrPatientScan?: boolean
};

export type ClinicalCatalog = {
  hospitalProfile?: Partial<HospitalProfile>
  featureFlags?: FeatureFlags
  departments: string[]
  clinics: string[]
  visitTypes: CatalogOption[]
  referralSources: CatalogOption[]
  doctorSpecialties: string[]
  assignableDoctors: string[]
  staffClinicians?: StaffClinician[]
  paymentMethods: CatalogOption[]
  wardTypes: CatalogOption[]
  bedTypes: CatalogOption[]
  identifierLabels: CatalogOption[]
  maternityDeliveryTypes?: CatalogOption[]
  maternityAncTemplates?: CatalogOption[]
  printTemplates?: Record<
    string,
    { name: string; html?: string; docxStoragePath?: string; docxFilename?: string }
  >
  facilities?: import('./hospital-configuration').FacilitySite[]
  structuredDepartments?: import('./hospital-configuration').StructuredDepartment[]
  structuredClinics?: import('./hospital-configuration').StructuredClinic[]
  /** @deprecated use doctorSpecialties */
  doctorCategories: string[]
}

export const defaultClinicalCatalog: ClinicalCatalog = {
  hospitalProfile: {
    facilityName: 'AfyaSasa Hospital',
    mohFacilityCode: '',
    licenceNumber: '',
    address: '',
    contactPhone: '',
    contactEmail: '',
    primaryColor: '#0d9488',
  },
  departments: ['Outpatient', 'Emergency', 'Maternity', 'Paediatrics'],
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
  referralSources: [
    { value: 'self', label: 'Self / walk-in' },
    { value: 'community', label: 'Community health worker' },
    { value: 'facility', label: 'Referring facility' },
    { value: 'insurance', label: 'Insurance scheme' },
    { value: 'employer', label: 'Employer' },
  ],
  doctorSpecialties: ['Consultant', 'Medical Officer', 'Clinical Officer', 'Specialist'],
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
  wardTypes: [
    { value: 'general', label: 'General Ward' },
    { value: 'icu', label: 'ICU' },
    { value: 'hdu', label: 'HDU' },
    { value: 'maternity', label: 'Maternity' },
    { value: 'paediatric', label: 'Paediatric' },
    { value: 'isolation', label: 'Isolation' },
  ],
  bedTypes: [
    { value: 'standard', label: 'Standard' },
    { value: 'icu', label: 'ICU' },
    { value: 'isolation', label: 'Isolation' },
    { value: 'maternity', label: 'Maternity' },
  ],
  identifierLabels: [
    { value: 'national_id', label: 'ID Number' },
    { value: 'sha', label: 'SHA Number' },
    { value: 'passport', label: 'Passport Number' },
    { value: 'birth_certificate', label: 'Certificate Number' },
    { value: 'alien_id', label: 'Alien ID Number' },
  ],
}

export function normalizeClinicalCatalog(raw?: Partial<ClinicalCatalog> | null): ClinicalCatalog {
  const specialties =
    raw?.doctorSpecialties?.length
      ? raw.doctorSpecialties
      : raw?.doctorCategories?.length
        ? raw.doctorCategories
        : defaultClinicalCatalog.doctorSpecialties

  return {
    hospitalProfile: {
      ...defaultClinicalCatalog.hospitalProfile,
      ...raw?.hospitalProfile,
    },
    departments: raw?.departments?.length ? raw.departments : defaultClinicalCatalog.departments,
    clinics: raw?.clinics?.length ? raw.clinics : defaultClinicalCatalog.clinics,
    visitTypes: raw?.visitTypes?.length ? raw.visitTypes : defaultClinicalCatalog.visitTypes,
    referralSources: raw?.referralSources?.length
      ? raw.referralSources
      : defaultClinicalCatalog.referralSources,
    doctorSpecialties: specialties,
    doctorCategories: specialties,
    assignableDoctors: raw?.assignableDoctors ?? defaultClinicalCatalog.assignableDoctors,
    staffClinicians: raw?.staffClinicians ?? [],
    paymentMethods: raw?.paymentMethods?.length
      ? raw.paymentMethods
      : defaultClinicalCatalog.paymentMethods,
    wardTypes: raw?.wardTypes?.length ? raw.wardTypes : defaultClinicalCatalog.wardTypes,
    bedTypes: raw?.bedTypes?.length ? raw.bedTypes : defaultClinicalCatalog.bedTypes,
    identifierLabels: raw?.identifierLabels?.length
      ? raw.identifierLabels
      : defaultClinicalCatalog.identifierLabels,
    maternityDeliveryTypes: raw?.maternityDeliveryTypes ?? [],
    maternityAncTemplates: raw?.maternityAncTemplates ?? [],
    printTemplates: raw?.printTemplates ?? {},
    featureFlags: {
      qrPatientScan: false,
      ...(raw?.featureFlags ?? {}),
    },
    facilities: raw?.facilities ?? [],
    structuredDepartments: raw?.structuredDepartments ?? [],
    structuredClinics: raw?.structuredClinics ?? [],
  }
}

const legacyIdentifierLabels: Record<string, string> = {
  national_id: 'ID Number',
  sha: 'SHA Number',
  passport: 'Passport Number',
  birth_certificate: 'Certificate Number',
  alien_id: 'Alien ID Number',
}

export function identifierFieldLabel(
  type: string,
  catalog?: ClinicalCatalog | null,
): string {
  const fromCatalog = catalog?.identifierLabels?.find((item) => item.value === type)?.label
  return fromCatalog ?? legacyIdentifierLabels[type] ?? 'Identifier'
}

/** Doctors for dropdowns — user accounts first, legacy catalog names as fallback. */
export function doctorSelectOptions(catalog?: ClinicalCatalog | null): CatalogOption[] {
  const fromStaff = (catalog?.staffClinicians ?? []).map((doctor) => ({
    value: doctor.id,
    label: doctor.label || `Dr. ${doctor.firstName} ${doctor.lastName}`,
  }))
  if (fromStaff.length) return fromStaff
  return (catalog?.assignableDoctors ?? []).map((name) => ({ value: name, label: name }))
}
