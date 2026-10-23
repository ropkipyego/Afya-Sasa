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
  'Sick Sheets': 'opd',
  'Medical Documents': 'documents',
  'Hospital Library': 'documents',
  'Triage Queue': 'opd',
  'Doctor Queue': 'opd',
  'Lab Queue': 'laboratory',
  Dashboard: 'pharmacy',
  'Prescription & OTC Queue': 'pharmacy',
  'OTC Point of Sale': 'pharmacy',
  'Products & Stock': 'pharmacy',
  'Pharmacy Queue': 'pharmacy',
  'Imaging Queue': 'radiology',
  'All Queues': 'reporting',
  Worklists: 'reporting',
  Laboratory: 'laboratory',
  'Blood Bank': 'laboratory',
  Radiology: 'radiology',
  'Pharmacy Dispensing': 'pharmacy',
  'Pharmacy Sales': 'pharmacy',
  'Pharmacy Stock': 'pharmacy',
  'Pharmacy Stock Take': 'pharmacy',
  'Pharmacy Products': 'pharmacy',
  'Pharmacy Reports': 'pharmacy',
  'Inpatient (IPD)': 'ipd',
  Nursing: 'ipd',
  ICU: 'icu',
  HDU: 'icu',
  Emergency: 'emergency',
  Theatre: 'theatre',
  Maternity: 'maternity',
  Orders: 'opd',
  Pharmacy: 'pharmacy',
  'Pharmacy Sales POS': 'pharmacy',
  'Inventory & Store': 'inventory',
  Reports: 'reporting',
  'Director Dashboard': 'reporting',
  Interoperability: 'registration',
  'Hospital Control Center': 'registration',
  'Pharmacy Configuration': 'inventory',
  'Stock Oversight': 'inventory',
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
