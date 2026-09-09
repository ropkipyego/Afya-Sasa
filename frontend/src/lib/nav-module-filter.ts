import type { HospitalModuleKey } from './hospital-configuration'
import { isModuleEnabled } from './hospital-configuration'
import type { ExtendedClinicalCatalog } from './hospital-configuration'
import type { NavItem } from './navigation'

/** Maps each nav item to the facility module that gates visibility. */
export const navModuleMap: Partial<Record<string, HospitalModuleKey>> = {
  'Register Patient': 'registration',
  'OPD Check-In': 'opd',
  Appointments: 'opd',
  Referrals: 'opd',
  'Sick Sheets': 'documents',
  'Medical Documents': 'documents',
  'Hospital Library': 'documents',
  'Triage Queue': 'opd',
  'Doctor Queue': 'opd',
  Worklists: 'reporting',
  Laboratory: 'laboratory',
  Radiology: 'radiology',
  'Inpatient (IPD)': 'ipd',
  Nursing: 'ipd',
  ICU: 'icu',
  HDU: 'icu',
  Emergency: 'emergency',
  Theatre: 'theatre',
  Maternity: 'maternity',
  Orders: 'pharmacy',
  Pharmacy: 'pharmacy',
  'Inventory & Store': 'pharmacy',
  Reports: 'reporting',
  'Hospital Control Center': 'registration',
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
