import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  AlertTriangle,
  Baby,
  BedDouble,
  CalendarDays,
  ClipboardList,
  FileText,
  FlaskConical,
  HeartPulse,
  Hospital,
  Landmark,
  LayoutDashboard,
  Megaphone,
  Package,
  Pill,
  Printer,
  ScanFace,
  ScanLine,
  Settings,
  Shield,
  Stethoscope,
  UserPlus,
  Users,
} from 'lucide-react'

export type NavItem = {
  group: string
  label: string
  icon: LucideIcon
  permission: string
  shortLabel?: string
}

export const navigation: NavItem[] = [
  { group: 'Dashboard', label: 'All Queues', icon: ClipboardList, permission: 'worklists:read', shortLabel: 'Today' },

  { group: 'Front Office', label: 'Register Patient', icon: UserPlus, permission: 'patients:create', shortLabel: 'Register' },
  { group: 'Front Office', label: 'Patient Registry', icon: Users, permission: 'patients:read', shortLabel: 'Registry' },
  { group: 'Front Office', label: 'Identify Patient', icon: ScanFace, permission: 'patients:search', shortLabel: 'Identify' },
  { group: 'Front Office', label: 'OPD Check-In', icon: Hospital, permission: 'encounters:create', shortLabel: 'Check-in' },
  { group: 'Front Office', label: 'Appointments', icon: CalendarDays, permission: 'appointments:read' },

  { group: 'OPD Module', label: 'Triage Queue', icon: HeartPulse, permission: 'triage:read', shortLabel: 'Triage' },
  { group: 'OPD Module', label: 'Doctor Queue', icon: Stethoscope, permission: 'consultations:read', shortLabel: 'Doctor' },
  { group: 'OPD Module', label: 'Sick Sheets', icon: Printer, permission: 'sick_sheets:read', shortLabel: 'Sick sheet' },
  { group: 'OPD Module', label: 'Referrals', icon: FileText, permission: 'referrals:read' },
  { group: 'OPD Module', label: 'Orders', icon: ClipboardList, permission: 'worklists:read', shortLabel: 'Orders' },

  { group: 'IPD Module', label: 'Inpatient (IPD)', icon: BedDouble, permission: 'admissions:read', shortLabel: 'IPD' },
  { group: 'IPD Module', label: 'ICU', icon: Activity, permission: 'icu_admissions:read' },
  { group: 'IPD Module', label: 'HDU', icon: HeartPulse, permission: 'hdu_admissions:read' },
  { group: 'IPD Module', label: 'Nursing', icon: HeartPulse, permission: 'admissions:read', shortLabel: 'Nursing' },

  { group: 'Laboratory', label: 'Laboratory', icon: FlaskConical, permission: 'lab_requests:read', shortLabel: 'Lab' },
  { group: 'Laboratory', label: 'Lab Queue', icon: FlaskConical, permission: 'lab_requests:read', shortLabel: 'Lab queue' },
  { group: 'Laboratory', label: 'Blood Bank', icon: FlaskConical, permission: 'lab_requests:read', shortLabel: 'Blood bank' },
  { group: 'Radiology', label: 'Radiology', icon: ScanLine, permission: 'radiology_requests:read', shortLabel: 'Imaging' },
  { group: 'Radiology', label: 'Imaging Queue', icon: ScanLine, permission: 'radiology_requests:read', shortLabel: 'Imaging queue' },

  { group: 'Specialty & Procedures', label: 'Emergency', icon: AlertTriangle, permission: 'emergency:read', shortLabel: 'ED' },
  { group: 'Specialty & Procedures', label: 'Theatre', icon: Hospital, permission: 'surgery_bookings:read' },
  { group: 'Specialty & Procedures', label: 'Maternity', icon: Baby, permission: 'pregnancies:read' },

  { group: 'Pharmacy & Supply', label: 'Dashboard', icon: Pill, permission: 'pharmacy:read', shortLabel: 'Dashboard' },
  { group: 'Pharmacy & Supply', label: 'Prescription & OTC Queue', icon: ClipboardList, permission: 'pharmacy:read', shortLabel: 'Queue' },
  { group: 'Pharmacy & Supply', label: 'OTC Point of Sale', icon: Landmark, permission: 'pharmacy:read', shortLabel: 'POS' },
  { group: 'Pharmacy & Supply', label: 'Products & Stock', icon: Package, permission: 'pharmacy:read', shortLabel: 'Stock' },

  { group: 'Procurement and Store', label: 'Inventory & Store', icon: Package, permission: 'inventory:read', shortLabel: 'Store' },

  { group: 'Finance', label: 'Cashier / Billing', icon: Landmark, permission: 'payments:initiate', shortLabel: 'Cashier' },
  { group: 'Finance', label: 'Insurance & Claims', icon: Shield, permission: 'payments:read', shortLabel: 'Insurance' },

  { group: 'Documents & Reports', label: 'Medical Documents', icon: FileText, permission: 'patients:history', shortLabel: 'Med docs' },
  { group: 'Documents & Reports', label: 'Hospital Library', icon: FileText, permission: 'hospital_documents:read', shortLabel: 'Library' },
  { group: 'Documents & Reports', label: 'Reports', icon: LayoutDashboard, permission: 'reports:read' },

  { group: 'Marketing & Outreach', label: 'Marketing', icon: Megaphone, permission: 'marketing:read', shortLabel: 'Outreach' },

  { group: 'Management & Intelligence', label: 'Director Dashboard', icon: LayoutDashboard, permission: 'reports:read', shortLabel: 'Director' },

  { group: 'Hospital Control Center', label: 'Pharmacy Configuration', icon: Pill, permission: 'inventory:read', shortLabel: 'Pharmacy cfg' },
  { group: 'Hospital Control Center', label: 'Hospital Control Center', icon: Settings, permission: 'settings:manage', shortLabel: 'Admin' },
  { group: 'Hospital Control Center', label: 'Interoperability', icon: Activity, permission: 'settings:manage', shortLabel: 'FHIR' },
]

export const NAV_GROUP_ORDER = [
  'Dashboard',
  'Front Office',
  'OPD Module',
  'IPD Module',
  'Laboratory',
  'Radiology',
  'Specialty & Procedures',
  'Pharmacy & Supply',
  'Procurement and Store',
  'Finance',
  'Documents & Reports',
  'Marketing & Outreach',
  'Management & Intelligence',
  'Hospital Control Center',
] as const

export const groupIcons: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard,
  'Front Office': UserPlus,
  'OPD Module': Stethoscope,
  'IPD Module': BedDouble,
  Laboratory: FlaskConical,
  Radiology: ScanLine,
  'Specialty & Procedures': Baby,
  'Pharmacy & Supply': Pill,
  'Procurement and Store': Package,
  Finance: Landmark,
  'Documents & Reports': FileText,
  'Marketing & Outreach': Megaphone,
  'Management & Intelligence': LayoutDashboard,
  'Hospital Control Center': Settings,
}

export function sortNavGroups(groups: string[]) {
  return [...groups].sort((a, b) => {
    const ai = NAV_GROUP_ORDER.indexOf(a as (typeof NAV_GROUP_ORDER)[number])
    const bi = NAV_GROUP_ORDER.indexOf(b as (typeof NAV_GROUP_ORDER)[number])
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
}

export const workflowDescriptions: Record<string, string> = {
  'Identify Patient': 'Identify an existing patient with the DigitalPersona 4500, then open the normal patient file.',
  'Register Patient': 'Search globally in the header first — register only if no match exists.',
  'OPD Check-In': 'Step-by-step check-in — patient, clinic, visit type, then confirm.',
  'Triage Queue': 'Nurse queue — vitals, category, then send to the doctor.',
  'Doctor Queue': 'Doctor queue — SOAP, orders, files, complete the visit.',
  'Lab Queue': 'Laboratory worklist — samples waiting on the bench.',
  'Pharmacy Queue': 'Prescriptions waiting to be dispensed.',
  'Imaging Queue': 'Radiology worklist — studies waiting to be done or reported.',
  'All Queues': 'Hospital-wide queue board — OPD, ED, IPD, lab, imaging, and pharmacy.',
  Appointments: 'Appointment center with status workflow and calendar views.',
  Referrals: 'Referral workspace with letter generation and status tracking.',
  'Medical Documents': 'Unified document repository linked to patient profile timeline.',
  'Sick Sheets': 'Issue, print, and store sick leave certificates.',
  Worklists: 'Hospital-wide queue board.',
  'Care Queues': 'Hospital-wide queue board.',
  'Patient Registry': 'Browse all registered patients with age-band filters and basic demographics.',
  Finance: 'Cashier desk — same payment ledger. Not a second billing system.',
  'Cashier / Billing': 'Search a patient, settle existing charges, reprint receipts, and reconcile the cash point.',
  'Insurance & Claims': 'Payers, SHA eligibility, and operational claim drafts. Portal claims stay on portal.sha.go.ke.',
  Payments: 'Hospital-wide cashier — M-Pesa STK, cash, card, insurance, and QuickBooks for any service.',
  Marketing: 'Record daily outreach activities, track follow-ups, and review team performance.',
  Laboratory: 'Lab overview, sample worklist, and clinician results inbox.',
  'Blood Bank': 'Laboratory blood bank — grouping, crossmatch and issue. Not pharmacy stock.',
  Radiology: 'Imaging overview and reporting worklist.',
  Emergency: 'ED command center — triage, bays, observation, disposition.',
  Dashboard: 'Pharmacy operational summary — OPD/IPD prescriptions, today’s OTC sales, stock availability, and alerts.',
  'Prescription & OTC Queue': 'Unified OPD, IPD, and OTC pharmacy queue with stock eligibility and cashier clearance.',
  'OTC Point of Sale': 'Walk-in or identified patient checkout. Prepare, cashier, then issue. Not a second ledger.',
  'Products & Stock': 'Searchable, sortable batch and catalogue stock table with on-hand, reserved, and available quantities.',
  Pharmacy: 'Pharmacy operational summary — OPD/IPD prescriptions, today’s OTC sales, stock availability, and alerts.',
  'Pharmacy Configuration': 'Catalogue administration, stores, stock-take sessions, batch rules, approvals, and ledger reports.',
  Maternity: 'Maternity service line — ANC, labour, delivery, postnatal.',
  Orders: 'Clinical orders from all departments — lab, imaging, procedures.',
  'Inventory & Store': 'Supply overview, requisitions, buying list, transfers, and goods receipt. Not the pharmacy queue.',
  Nursing: 'Nursing command — vitals, MAR, observations, and shift notes.',
  Reports: 'OPD, clinical, analytics, and operations reporting.',
  'Director Dashboard': 'Hospital-wide operational intelligence from persisted tables. Not a general ledger.',
  Interoperability: 'Kenya Core FHIR mapping and validation. Sandbox stays disconnected until official credentials exist.',
  'Inpatient (IPD)': 'Visual ward board → patient workspace.',
  ICU: 'Intensive care — monitoring, ventilator, and consultant rounds.',
  HDU: 'High dependency unit — enhanced monitoring and step-down care.',
  'Hospital Control Center': 'Configure hospital, users, SMS, documents, security, health, and backup.',
  'Stock Oversight': 'Catalogue administration, stores, stock-take sessions, batch rules, approvals, and ledger reports.',
  'Hospital Library': 'Hospital-wide policies, protocols, and forms.',
}
