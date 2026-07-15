import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  AlertTriangle,
  Baby,
  BedDouble,
  Bell,
  CalendarDays,
  ClipboardList,
  FileText,
  FlaskConical,
  HeartPulse,
  Hospital,
  LayoutDashboard,
  Printer,
  ScanLine,
  Search,
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
  // Reception
  { group: 'Reception', label: 'Patient Search', icon: Search, permission: 'patients:read', shortLabel: 'Search' },
  { group: 'Reception', label: 'Register Patient', icon: UserPlus, permission: 'patients:create', shortLabel: 'Register' },
  { group: 'Reception', label: 'Patient Timeline', icon: ClipboardList, permission: 'patients:history', shortLabel: 'Timeline' },
  { group: 'Reception', label: 'OPD Check-In', icon: Hospital, permission: 'encounters:create', shortLabel: 'Check-in' },
  { group: 'Reception', label: 'Appointments', icon: CalendarDays, permission: 'appointments:read' },

  // Outpatient (referrals + sick sheets moved here)
  { group: 'Outpatient', label: 'Triage Queue', icon: HeartPulse, permission: 'triage:read', shortLabel: 'Triage' },
  { group: 'Outpatient', label: 'OPD Patients', icon: Users, permission: 'worklists:read', shortLabel: 'Patients' },
  { group: 'Outpatient', label: 'Doctor Queue', icon: Stethoscope, permission: 'consultations:read', shortLabel: 'Doctor' },
  { group: 'Outpatient', label: 'Referrals', icon: FileText, permission: 'referrals:read' },
  { group: 'Outpatient', label: 'Sick Sheets', icon: Printer, permission: 'sick_sheets:read', shortLabel: 'Sick sheet' },

  // Documents
  { group: 'Documents', label: 'Medical Documents', icon: FileText, permission: 'patients:history', shortLabel: 'Med docs' },
  { group: 'Documents', label: 'Hospital Library', icon: FileText, permission: 'hospital_documents:read', shortLabel: 'Library' },

  // Laboratory (own department)
  { group: 'Laboratory', label: 'Lab Dashboard', icon: LayoutDashboard, permission: 'lab_requests:read', shortLabel: 'Lab home' },
  { group: 'Laboratory', label: 'Laboratory', icon: FlaskConical, permission: 'lab_requests:read', shortLabel: 'Worklist' },
  { group: 'Laboratory', label: 'Lab Patients', icon: Users, permission: 'worklists:read', shortLabel: 'Patients' },
  { group: 'Laboratory', label: 'Results Inbox', icon: ClipboardList, permission: 'lab_results:read', shortLabel: 'Results' },

  // Imaging / Radiology (own department)
  { group: 'Imaging', label: 'Imaging Dashboard', icon: LayoutDashboard, permission: 'radiology_requests:read', shortLabel: 'Img home' },
  { group: 'Imaging', label: 'Radiology', icon: ScanLine, permission: 'radiology_requests:read', shortLabel: 'Worklist' },
  { group: 'Imaging', label: 'Imaging Patients', icon: Users, permission: 'worklists:read', shortLabel: 'Patients' },

  // Inpatient
  { group: 'Inpatient', label: 'Inpatient (IPD)', icon: BedDouble, permission: 'admissions:read', shortLabel: 'IPD' },
  { group: 'Inpatient', label: 'IPD Patients', icon: Users, permission: 'worklists:read', shortLabel: 'Patients' },
  { group: 'Inpatient', label: 'ICU', icon: Activity, permission: 'icu_admissions:read' },
  { group: 'Inpatient', label: 'HDU', icon: HeartPulse, permission: 'hdu_admissions:read' },
  { group: 'Inpatient', label: 'Nursing', icon: HeartPulse, permission: 'admissions:read', shortLabel: 'Nursing' },

  // Emergency
  { group: 'Emergency', label: 'Emergency', icon: AlertTriangle, permission: 'emergency:read', shortLabel: 'ED' },
  { group: 'Emergency', label: 'ED Patients', icon: Users, permission: 'worklists:read', shortLabel: 'Patients' },

  // Specialty
  { group: 'Specialty', label: 'Theatre', icon: Hospital, permission: 'surgery_bookings:read' },
  { group: 'Specialty', label: 'Maternity', icon: Baby, permission: 'pregnancies:read' },
  { group: 'Specialty', label: 'Pharmacy', icon: ClipboardList, permission: 'reports:read', shortLabel: 'Pharmacy' },

  // Reports
  { group: 'Reports', label: 'OPD Reports', icon: ClipboardList, permission: 'reports:read' },
  { group: 'Reports', label: 'Clinical Reports', icon: ClipboardList, permission: 'reports:read', shortLabel: 'Clinical' },
  { group: 'Reports', label: 'Executive Analytics', icon: LayoutDashboard, permission: 'reports:read', shortLabel: 'Analytics' },
  { group: 'Reports', label: 'Operations Center', icon: LayoutDashboard, permission: 'reports:read', shortLabel: 'Ops' },
  { group: 'Reports', label: 'Clinical Orders', icon: ClipboardList, permission: 'lab_requests:read', shortLabel: 'Orders' },
  { group: 'Reports', label: 'Worklists', icon: ClipboardList, permission: 'worklists:read', shortLabel: 'Lists' },

  // Administration
  { group: 'Administration', label: 'Notifications', icon: Bell, permission: 'notifications:read' },
  { group: 'Administration', label: 'Hospital Control Center', icon: Settings, permission: 'settings:manage', shortLabel: 'Admin' },
]

export const groupIcons: Record<string, LucideIcon> = {
  Reception: Users,
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
  'Patient Search': 'Find existing patients first, then open their safety banner and profile.',
  'Register Patient': 'Search first, then register with progressive optional sections.',
  'Patient Timeline': 'Full chronological journey with filters and workflow status.',
  'OPD Check-In': 'Step-by-step check-in — patient, clinic, visit type, then confirm.',
  'Triage Queue': 'Nurse workspace with vitals, alerts, and previous visits.',
  'OPD Patients': 'Outpatients in clinic workflow — search, filter by queue, open chart.',
  'Doctor Queue': 'Prioritised queue with SOAP notes, diagnosis entry, and completion.',
  Appointments: 'Appointment center with status workflow and calendar views.',
  Referrals: 'Referral workspace with letter generation and status tracking.',
  'Medical Documents': 'Unified document repository linked to patient timeline.',
  'Sick Sheets': 'Issue, print, and store sick leave certificates.',
  'Lab Dashboard': 'Laboratory command view — pending samples, TAT, critical results.',
  Laboratory: 'Lab operations center — card worklist from request to verified.',
  'Lab Patients': 'Patients with active laboratory requests in this department.',
  'Imaging Dashboard': 'Imaging command view — pending studies, modalities, turnaround.',
  Radiology: 'Imaging worklist with text report and PDF attach.',
  'Imaging Patients': 'Patients with radiology requests across the imaging workflow.',
  Emergency: 'ED command center — triage, bays, observation, disposition, live alerts.',
  'ED Patients': 'Emergency department patients by triage and disposition queue.',
  Maternity: 'Full maternity service line — ANC, labour, delivery, nursery, NICU.',
  'Operations Center': 'Executive hospital command dashboard.',
  'Executive Analytics': 'BI dashboard with date ranges, trends, comparisons, and configurable widgets.',
  'Clinical Orders': 'Unified clinical orders — lab, imaging, and pharmacy across the hospital.',
  Pharmacy: 'Medication orders and dispensing queue (pilot).',
  Nursing: 'Nursing command — vitals, MAR, observations, and shift notes.',
  Worklists: 'Cross-department operational queues with search and pagination.',
  Notifications: 'Internal inbox for results, referrals, and tasks.',
  'Inpatient (IPD)': 'Visual ward board → patient workspace. ICU and HDU live here.',
  'IPD Patients': 'Current admissions and discharge-ready inpatients.',
  ICU: 'Intensive care unit — critical patients under IPD.',
  HDU: 'High dependency unit — step-down critical care under IPD.',
  'Hospital Control Center': 'Hospital operating system — organization, catalogs, facilities, security.',
  'Hospital Library': 'Hospital-wide policies, protocols, forms, and circulars for all departments.',
}
