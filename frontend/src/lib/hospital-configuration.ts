import type { ClinicalCatalog, HospitalProfile } from './clinical-catalog'

export type HospitalModuleKey =
  | 'registration'
  | 'opd'
  | 'ipd'
  | 'theatre'
  | 'icu'
  | 'laboratory'
  | 'radiology'
  | 'maternity'
  | 'emergency'
  | 'pharmacy'
  | 'documents'
  | 'reporting'

export type FacilitySite = {
  id: string
  name: string
  shortName?: string
  type: 'main' | 'satellite' | 'clinic'
  active: boolean
  address?: string
  phone?: string
  modules: Partial<Record<HospitalModuleKey, boolean>>
  brandingOverride?: Partial<HospitalProfile>
}

export type StructuredDepartment = {
  id: string
  name: string
  code?: string
  facilityId?: string
  headName?: string
  active: boolean
  clinicIds: string[]
}

export type StructuredClinic = {
  id: string
  name: string
  departmentId?: string
  facilityId?: string
  active: boolean
}

export type ExtendedClinicalCatalog = ClinicalCatalog & {
  facilities?: FacilitySite[]
  structuredDepartments?: StructuredDepartment[]
  structuredClinics?: StructuredClinic[]
}

export const HOSPITAL_MODULES: {
  key: HospitalModuleKey
  label: string
  description: string
}[] = [
  { key: 'registration', label: 'Registration', description: 'Patient registration and search' },
  { key: 'opd', label: 'OPD', description: 'Outpatient visits, triage, and consultation' },
  { key: 'ipd', label: 'IPD', description: 'Admissions, wards, transfers, discharge' },
  { key: 'theatre', label: 'Theatre', description: 'Surgical scheduling and operation notes' },
  { key: 'icu', label: 'ICU / HDU', description: 'Critical care workflows' },
  { key: 'laboratory', label: 'Laboratory', description: 'Lab requests, samples, and results' },
  { key: 'radiology', label: 'Radiology', description: 'Imaging requests and reports' },
  { key: 'maternity', label: 'Maternity', description: 'ANC, labour, delivery, postnatal' },
  { key: 'emergency', label: 'Emergency', description: 'Emergency department command center' },
  { key: 'pharmacy', label: 'Pharmacy', description: 'Dispensing (future module)' },
  { key: 'documents', label: 'Documents', description: 'Medical documents and certificates' },
  { key: 'reporting', label: 'Reporting', description: 'Clinical and operational reports' },
]

export const DEFAULT_MAIN_FACILITY_ID = 'main-hospital'

export const CONFIG_DEPENDENCY_HINTS: Record<string, string[]> = {
  departments: [
    'OPD check-in department lists',
    'User department assignment',
    'Referral routing',
    'Clinical reports',
  ],
  clinics: ['Appointments', 'OPD clinic selection', 'Reporting filters'],
  staffClinicians: [
    'Appointments',
    'OPD consultations',
    'Referrals',
    'Theatre team assignment',
    'Lab and radiology ordering',
  ],
  wards: ['Admissions', 'Transfers', 'Bed board', 'Occupancy reports'],
  laboratory: ['Lab worklist', 'Results inbox', 'Document templates'],
  radiology: ['Radiology worklist', 'Results inbox', 'Document templates'],
  hospitalProfile: [
    'Login screen',
    'Sidebar branding',
    'Patient cards',
    'Referral letters',
    'Sick sheets',
    'All printable PDFs',
    'Browser title and favicon',
  ],
  printTemplates: [
    'Sick sheets',
    'Referral letters',
    'Patient cards',
    'Discharge summaries',
    'Lab and radiology reports',
  ],
  facilities: ['Module activation per site', 'Future facility-scoped scheduling'],
  modules: ['Navigation visibility per facility (pilot)'],
}

function defaultModules(enabled = true): Partial<Record<HospitalModuleKey, boolean>> {
  return Object.fromEntries(HOSPITAL_MODULES.map((m) => [m.key, enabled])) as Partial<
    Record<HospitalModuleKey, boolean>
  >
}

export function defaultFacilities(profile?: Partial<HospitalProfile>): FacilitySite[] {
  const sharedModules = defaultModules(true)
  return [
    {
      id: DEFAULT_MAIN_FACILITY_ID,
      name: profile?.facilityName ?? 'Jalaram Hospital',
      shortName: profile?.shortName ?? 'Jalaram',
      type: 'main',
      active: true,
      address: profile?.physicalAddress ?? profile?.address ?? 'Nairobi',
      phone: profile?.contactPhone,
      modules: { ...sharedModules, pharmacy: true },
      brandingOverride: {
        facilityName: profile?.facilityName ?? 'Jalaram Hospital',
        primaryColor: '#0d9488',
      },
    },
    {
      id: 'city-clinic',
      name: 'City Clinic',
      shortName: 'City',
      type: 'clinic',
      active: true,
      address: 'City Clinic · Nairobi',
      modules: {
        ...sharedModules,
        ipd: false,
        icu: false,
        theatre: false,
        maternity: false,
        pharmacy: false,
      },
      brandingOverride: {
        facilityName: 'City Clinic',
        primaryColor: '#0369a1',
      },
    },
  ]
}

export function slugId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}

/** Propagate structured config into legacy list fields consumed across the app. */
export function syncCatalogDependencies(
  catalog: ExtendedClinicalCatalog,
): ExtendedClinicalCatalog {
  const structuredDepartments = catalog.structuredDepartments ?? []
  const structuredClinics = catalog.structuredClinics ?? []
  const facilities = catalog.facilities?.length
    ? catalog.facilities
    : defaultFacilities(catalog.hospitalProfile)

  const departmentsFromStructured = structuredDepartments
    .filter((d) => d.active)
    .map((d) => d.name)

  const clinicsFromStructured = structuredClinics
    .filter((c) => c.active)
    .map((c) => c.name)

  return {
    ...catalog,
    facilities,
    structuredDepartments,
    structuredClinics,
    departments: departmentsFromStructured.length
      ? departmentsFromStructured
      : catalog.departments,
    clinics: clinicsFromStructured.length ? clinicsFromStructured : catalog.clinics,
  }
}

export function mergeClinicalCatalogPatch(
  current: Partial<ExtendedClinicalCatalog> | null | undefined,
  patch: Partial<ExtendedClinicalCatalog>,
): ExtendedClinicalCatalog {
  const base = { ...(current ?? {}) } as ExtendedClinicalCatalog
  const merged: ExtendedClinicalCatalog = {
    ...base,
    ...patch,
    hospitalProfile: {
      ...(base.hospitalProfile ?? {}),
      ...(patch.hospitalProfile ?? {}),
    },
    printTemplates: {
      ...(base.printTemplates ?? {}),
      ...(patch.printTemplates ?? {}),
    },
    facilities: patch.facilities ?? base.facilities,
    structuredDepartments: patch.structuredDepartments ?? base.structuredDepartments,
    structuredClinics: patch.structuredClinics ?? base.structuredClinics,
  }
  return syncCatalogDependencies(merged)
}

export function isFeatureEnabled(
  catalog: ExtendedClinicalCatalog | null | undefined,
  flag: keyof import('./clinical-catalog').FeatureFlags,
): boolean {
  return catalog?.featureFlags?.[flag] === true
}

export function isModuleEnabled(
  catalog: ExtendedClinicalCatalog | null | undefined,
  module: HospitalModuleKey,
  facilityId = DEFAULT_MAIN_FACILITY_ID,
): boolean {
  const facilities = catalog?.facilities ?? defaultFacilities(catalog?.hospitalProfile)
  const facility = facilities.find((f) => f.id === facilityId) ?? facilities[0]
  return facility?.modules?.[module] !== false
}

export function resolveHospitalBranding(
  catalog: ExtendedClinicalCatalog | null | undefined,
  facilityId = DEFAULT_MAIN_FACILITY_ID,
): HospitalProfile & { shortName?: string; faviconUrl?: string; accentColor?: string } {
  const profile = catalog?.hospitalProfile ?? {}
  const facilities = catalog?.facilities ?? defaultFacilities(profile)
  const facility = facilities.find((f) => f.id === facilityId) ?? facilities[0]
  const override = facility?.brandingOverride ?? {}
  return {
    facilityName: 'Hospital',
    mohFacilityCode: '',
    licenceNumber: '',
    address: '',
    contactPhone: '',
    contactEmail: '',
    primaryColor: '#0d9488',
    ...profile,
    ...override,
  }
}
