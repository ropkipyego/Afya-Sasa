import type { HospitalModuleKey } from './hospital-configuration'
import { isModuleEnabled } from './hospital-configuration'
import type { ExtendedClinicalCatalog } from './hospital-configuration'
import type { NavItem } from './navigation'

/** Maps each nav item to the facility module that gates visibility. */
export const navModuleMap: Partial<Record<string, HospitalModuleKey>> = {
  'Patient Search': 'registration',
  'Register Patient': 'registration',
  'Patient Timeline': 'registration',
  'OPD Check-In': 'opd',
  Appointments: 'opd',
  Referrals: 'opd',
  'Sick Sheets': 'documents',
  'Medical Documents': 'documents',
  'Hospital Library': 'documents',
  'Triage Queue': 'opd',
  'OPD Patients': 'opd',
  'Doctor Queue': 'opd',
  'Lab Dashboard': 'laboratory',
  Laboratory: 'laboratory',
  'Lab Patients': 'laboratory',
  'Results Inbox': 'laboratory',
  'Imaging Dashboard': 'radiology',
  Radiology: 'radiology',
  'Imaging Patients': 'radiology',
  'Inpatient (IPD)': 'ipd',
  'IPD Patients': 'ipd',
  Nursing: 'ipd',
  ICU: 'icu',
  HDU: 'icu',
  Emergency: 'emergency',
  'ED Patients': 'emergency',
  Theatre: 'theatre',
  Maternity: 'maternity',
  Pharmacy: 'pharmacy',
  'OPD Reports': 'reporting',
  'Clinical Reports': 'reporting',
  'Executive Analytics': 'reporting',
  'Operations Center': 'reporting',
  'Clinical Orders': 'laboratory',
  Worklists: 'reporting',
  Notifications: 'registration',
  'Hospital Control Center': 'registration',
}

export function filterNavigationByModules(
  items: NavItem[],
  catalog?: ExtendedClinicalCatalog | null,
): NavItem[] {
  return items.filter((item) => {
    const module = navModuleMap[item.label]
    if (!module) return true
    // Pharmacy is opt-in; default false until enabled in facility modules
    if (module === 'pharmacy') {
      const facilities = catalog?.facilities
      if (!facilities?.length) return false
      return isModuleEnabled(catalog, 'pharmacy')
    }
    return isModuleEnabled(catalog, module)
  })
}
