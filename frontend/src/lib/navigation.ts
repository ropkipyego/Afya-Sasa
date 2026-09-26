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
  ScanLine,
  Settings,
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
  // Front Office
  { group: 'Front Office', label: 'Register Patient', icon: UserPlus, permission: 'patients:create', shortLabel: 'Register' },
  { group: 'Front Office', label: 'Patient Registry', icon: Users, permission: 'patients:read', shortLabel: 'Registry' },
  { group: 'Front Office', label: 'OPD Check-In', icon: Hospital, permission: 'encounters:create', shortLabel: 'Check-in' },
  { group: 'Front Office', label: 'Appointments', icon: CalendarDays, permission: 'appointments:read' },

  // Queue management — one place for waiting work
  { group: 'Queue Management', label: 'Triage Queue', icon: HeartPulse, permission: 'triage:read', shortLabel: 'Triage' },
  { group: 'Queue Management', label: 'Doctor Queue', icon: Stethoscope, permission: 'consultations:read', shortLabel: 'Doctor' },
  { group: 'Queue Management', label: 'Lab Queue', icon: FlaskConical, permission: 'lab_requests:read', shortLabel: 'Lab queue' },
  { group: 'Queue Management', label: 'Pharmacy Queue', icon: Pill, permission: 'pharmacy:read', shortLabel: 'Rx queue' },
  { group: 'Queue Management', label: 'Imaging Queue', icon: ScanLine, permission: 'radiology_requests:read', shortLabel: 'Imaging queue' },
  { group: 'Queue Management', label: 'All Queues', icon: ClipboardList, permission: 'worklists:read', shortLabel: 'All queues' },

  // Outpatient
  { group: 'Outpatient', label: 'Referrals', icon: FileText, permission: 'referrals:read' },
  { group: 'Outpatient', label: 'Sick Sheets', icon: Printer, permission: 'sick_sheets:read', shortLabel: 'Sick sheet' },

  // Documents
  { group: 'Documents', label: 'Medical Documents', icon: FileText, permission: 'patients:history', shortLabel: 'Med docs' },
  { group: 'Documents', label: 'Hospital Library', icon: FileText, permission: 'hospital_documents:read', shortLabel: 'Library' },

  // Laboratory
  { group: 'Laboratory', label: 'Laboratory', icon: FlaskConical, permission: 'lab_requests:read', shortLabel: 'Lab' },

  // Imaging
  { group: 'Imaging', label: 'Radiology', icon: ScanLine, permission: 'radiology_requests:read', shortLabel: 'Imaging' },

  // Inpatient
  { group: 'Inpatient', label: 'Inpatient (IPD)', icon: BedDouble, permission: 'admissions:read', shortLabel: 'IPD' },
  { group: 'Inpatient', label: 'ICU', icon: Activity, permission: 'icu_admissions:read' },
  { group: 'Inpatient', label: 'HDU', icon: HeartPulse, permission: 'hdu_admissions:read' },
  { group: 'Inpatient', label: 'Nursing', icon: HeartPulse, permission: 'admissions:read', shortLabel: 'Nursing' },

  // Emergency
  { group: 'Emergency', label: 'Emergency', icon: AlertTriangle, permission: 'emergency:read', shortLabel: 'ED' },

  // Pharmacy — main-sidebar dropdowns, not an inner operations pane
  { group: 'Pharmacy', label: 'Pharmacy', icon: Pill, permission: 'pharmacy:read', shortLabel: 'Pharmacy' },
  { group: 'Pharmacy', label: 'Pharmacy Dispensing', icon: Pill, permission: 'pharmacy:read', shortLabel: 'Dispense' },
  { group: 'Pharmacy', label: 'Pharmacy Sales', icon: Landmark, permission: 'pharmacy:read', shortLabel: 'Sales' },
  { group: 'Pharmacy', label: 'Pharmacy Stock', icon: Package, permission: 'pharmacy:read', shortLabel: 'Stock' },
  { group: 'Pharmacy', label: 'Pharmacy Stock Take', icon: ClipboardList, permission: 'pharmacy:read', shortLabel: 'Stock take' },
  { group: 'Pharmacy', label: 'Pharmacy Products', icon: Package, permission: 'pharmacy:read', shortLabel: 'Products' },
  { group: 'Pharmacy', label: 'Pharmacy Reports', icon: LayoutDashboard, permission: 'pharmacy:read', shortLabel: 'Rx reports' },

  { group: 'Finance', label: 'Finance', icon: Landmark, permission: 'payments:initiate', shortLabel: 'Finance' },

  { group: 'Specialty', label: 'Theatre', icon: Hospital, permission: 'surgery_bookings:read' },
  { group: 'Specialty', label: 'Maternity', icon: Baby, permission: 'pregnancies:read' },
  { group: 'Specialty', label: 'Orders', icon: ClipboardList, permission: 'worklists:read', shortLabel: 'Orders' },

  { group: 'Supply', label: 'Inventory & Store', icon: Package, permission: 'inventory:read', shortLabel: 'Store' },

  { group: 'Marketing', label: 'Marketing', icon: Megaphone, permission: 'marketing:read', shortLabel: 'Outreach' },

  // Reports
  { group: 'Reports', label: 'Reports', icon: LayoutDashboard, permission: 'reports:read' },

  // Administration
  { group: 'Administration', label: 'Hospital Control Center', icon: Settings, permission: 'settings:manage', shortLabel: 'Admin' },
]

export const groupIcons: Record<string, LucideIcon> = {
  'Front Office': UserPlus,
  'Queue Management': ClipboardList,
  Outpatient: Stethoscope,
  Documents: FileText,
  Laboratory: FlaskConical,
  Imaging: ScanLine,
  Inpatient: BedDouble,
  Emergency: AlertTriangle,
  Pharmacy: Pill,
  Finance: Landmark,
  Specialty: Baby,
  Supply: Package,
  Marketing: Megaphone,
  Reports: LayoutDashboard,
  Administration: Settings,
}

export const workflowDescriptions: Record<string, string> = {
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
  Finance: 'Finance desk — cashier, revenue, and SHA. Not Front Office. Same payment engine, not a new billing system.',
  Payments: 'Hospital-wide cashier — M-Pesa STK, cash, card, insurance, and QuickBooks for any service.',
  Marketing: 'Record daily outreach activities, track follow-ups, and review team performance.',
  Laboratory: 'Lab overview, sample worklist, and clinician results inbox.',
  Radiology: 'Imaging overview and reporting worklist.',
  Emergency: 'ED command center — triage, bays, observation, disposition.',
  Pharmacy: 'Pharmacy control center — today’s work and shortcuts.',
  'Pharmacy Dispensing': 'OPD and IPD prescriptions. Stock is deducted only when you confirm.',
  'Pharmacy Sales': 'Pharmacy collections from the existing payment ledger.',
  'Pharmacy Stock': 'Usable stock at the PHARMACY location.',
  'Pharmacy Stock Take': 'Count sheet import, preview, then confirm before posting.',
  'Pharmacy Products': 'Medication catalogue and sell prices.',
  'Pharmacy Reports': 'Pharmacy department export.',
  Maternity: 'Maternity service line — ANC, labour, delivery, postnatal.',
  Orders: 'Clinical orders from all departments — lab, imaging, procedures.',
  'Inventory & Store': 'Supply overview, requisitions, buying list, transfers, and goods receipt. Not the pharmacy queue.',
  Nursing: 'Nursing command — vitals, MAR, observations, and shift notes.',
  Reports: 'OPD, clinical, analytics, and operations reporting.',
  'Inpatient (IPD)': 'Visual ward board → patient workspace.',
  ICU: 'Intensive care — monitoring, ventilator, and consultant rounds.',
  HDU: 'High dependency unit — enhanced monitoring and step-down care.',
  'Hospital Control Center': 'Configure hospital, users, SMS, documents, and security.',
  'Hospital Library': 'Hospital-wide policies, protocols, and forms.',
}
