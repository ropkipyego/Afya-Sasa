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
  'Medical Documents': 'documents',
  'Sick Sheets': 'documents',
  'Triage Queue': 'opd',
  'Doctor Queue': 'opd',
  Laboratory: 'laboratory',
  Radiology: 'radiology',
  'Results Inbox': 'laboratory',
  'Inpatient (IPD)': 'ipd',
  ICU: 'icu',
  HDU: 'icu',
  Emergency: 'emergency',
  Theatre: 'theatre',
  Maternity: 'maternity',
  'OPD Reports': 'reporting',
  'Clinical Reports': 'reporting',
  'Operations Center': 'reporting',
  Notifications: 'registration',
  'Hospital Control Center': 'registration',
  'Hospital Library': 'documents',
}

export function filterNavigationByModules(
  items: NavItem[],
  catalog?: ExtendedClinicalCatalog | null,
): NavItem[] {
  return items.filter((item) => {
    const module = navModuleMap[item.label]
    if (!module) return true
    return isModuleEnabled(catalog, module)
  })
}
