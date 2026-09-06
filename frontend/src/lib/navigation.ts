import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  AlertTriangle,
  Baby,
  BedDouble,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  FlaskConical,
  HeartPulse,
  Hospital,
  LayoutDashboard,
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
  { group: 'Front Office', label: 'Payments', icon: CreditCard, permission: 'payments:initiate', shortLabel: 'Pay' },

  // Outpatient
  { group: 'Outpatient', label: 'Triage Queue', icon: HeartPulse, permission: 'triage:read', shortLabel: 'Triage' },
  { group: 'Outpatient', label: 'Doctor Queue', icon: Stethoscope, permission: 'consultations:read', shortLabel: 'Doctor' },
  { group: 'Outpatient', label: 'Referrals', icon: FileText, permission: 'referrals:read' },
  { group: 'Outpatient', label: 'Sick Sheets', icon: Printer, permission: 'sick_sheets:read', shortLabel: 'Sick sheet' },
  { group: 'Outpatient', label: 'Care Queues', icon: ClipboardList, permission: 'worklists:read', shortLabel: 'Queues' },

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

  // Specialty & supply
  { group: 'Specialty', label: 'Pharmacy', icon: Pill, permission: 'pharmacy:read', shortLabel: 'Pharmacy' },
  { group: 'Specialty', label: 'Theatre', icon: Hospital, permission: 'surgery_bookings:read' },
  { group: 'Specialty', label: 'Maternity', icon: Baby, permission: 'pregnancies:read' },
  { group: 'Specialty', label: 'Orders', icon: ClipboardList, permission: 'worklists:read', shortLabel: 'Orders' },
  { group: 'Specialty', label: 'Inventory & Store', icon: Package, permission: 'inventory:read', shortLabel: 'Store' },

  // Reports
  { group: 'Reports', label: 'Reports', icon: LayoutDashboard, permission: 'reports:read' },

  // Administration
  { group: 'Administration', label: 'Hospital Control Center', icon: Settings, permission: 'settings:manage', shortLabel: 'Admin' },
]

export const groupIcons: Record<string, LucideIcon> = {
  'Front Office': UserPlus,
  Outpatient: Stethoscope,
  Documents: FileText,
  Laboratory: FlaskConical,
  Imaging: ScanLine,
  Inpatient: BedDouble,
  Emergency: AlertTriangle,
  Specialty: Baby,
  Reports: LayoutDashboard,
  Administration: Settings,
}

export const workflowDescriptions: Record<string, string> = {
  'Register Patient': 'Search globally in the header first — register only if no match exists.',
  'OPD Check-In': 'Step-by-step check-in — patient, clinic, visit type, then confirm.',
  'Triage Queue': 'Nurse workspace with vitals, alerts, and previous visits.',
  'Doctor Queue': 'Prioritised queue with SOAP notes, orders, files, and completion.',
  Appointments: 'Appointment center with status workflow and calendar views.',
  Referrals: 'Referral workspace with letter generation and status tracking.',
  'Medical Documents': 'Unified document repository linked to patient profile timeline.',
  'Sick Sheets': 'Issue, print, and store sick leave certificates.',
  Worklists: 'Cross-department patient queues — filter by OPD, lab, imaging, IPD, or ED.',
  'Care Queues': 'Cross-department patient queues — filter by OPD, lab, imaging, IPD, or ED.',
  'Patient Registry': 'Browse all registered patients with age-band filters and basic demographics.',
  Payments: 'Hospital-wide cashier — M-Pesa STK, cash, card, insurance, and QuickBooks for any service.',
  Laboratory: 'Lab overview, sample worklist, and clinician results inbox.',
  Radiology: 'Imaging overview and reporting worklist.',
  Emergency: 'ED command center — triage, bays, observation, disposition.',
  Pharmacy: 'Dispense prescriptions, check pharmacy stock, and record OTC sales.',
  Maternity: 'Maternity service line — ANC, labour, delivery, postnatal.',
  Orders: 'Clinical orders from all departments — lab, imaging, procedures.',
  'Inventory & Store': 'Stock levels, requisitions, and goods receipt.',
  Nursing: 'Nursing command — vitals, MAR, observations, and shift notes.',
  Reports: 'OPD, clinical, analytics, and operations reporting.',
  'Inpatient (IPD)': 'Visual ward board → patient workspace.',
  ICU: 'Intensive care — monitoring, ventilator, and consultant rounds.',
  HDU: 'High dependency unit — enhanced monitoring and step-down care.',
  'Hospital Control Center': 'Configure hospital, users, SMS, documents, and security.',
  'Hospital Library': 'Hospital-wide policies, protocols, and forms.',
}
