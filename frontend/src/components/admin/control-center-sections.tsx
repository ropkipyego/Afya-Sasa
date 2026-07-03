import type { ReactNode } from 'react'
import {
  Activity,
  Bell,
  Building2,
  ClipboardList,
  FileText,
  FlaskConical,
  Heart,
  HardDrive,
  Palette,
  Printer,
  Scan,
  Settings,
  Shield,
  Stethoscope,
  Users,
} from 'lucide-react'
import type { ControlCenterSection } from './HospitalControlCenter'

export type ControlCenterCard = {
  id: Exclude<ControlCenterSection, 'home'>
  title: string
  description: string
  category: string
  icon: ReactNode
  keywords: string[]
  help: string
}

export const controlCenterCards: ControlCenterCard[] = [
  {
    id: 'organization',
    title: 'Hospital profile',
    description: 'Facility identity, MOH codes, contacts, locale, and registration.',
    category: 'Organization',
    icon: <Building2 className="h-6 w-6" />,
    keywords: ['hospital', 'profile', 'moh', 'facility', 'identity', 'registration'],
    help: 'Changes here update letterhead, patient cards, and system defaults hospital-wide.',
  },
  {
    id: 'facilities',
    title: 'Facilities & modules',
    description: 'Main hospital, satellite clinics, and per-site module activation.',
    category: 'Organization',
    icon: <Building2 className="h-6 w-6" />,
    keywords: ['clinic', 'satellite', 'modules', 'opd', 'ipd', 'multi-facility'],
    help: 'Enable lightweight clinic deployments while sharing one patient database.',
  },
  {
    id: 'users',
    title: 'User & access management',
    description: 'Staff accounts, activation, departments, and access control.',
    category: 'Users & security',
    icon: <Users className="h-6 w-6" />,
    keywords: ['users', 'staff', 'accounts', 'password', 'unlock'],
    help: 'New doctors appear immediately in appointments, OPD, referrals, and orders.',
  },
  {
    id: 'roles',
    title: 'Roles & permissions',
    description: 'Permission bundles, role cloning, and clinical access boundaries.',
    category: 'Users & security',
    icon: <Shield className="h-6 w-6" />,
    keywords: ['roles', 'permissions', 'rbac', 'security', 'access'],
    help: 'Granular permissions control what each role can view or change.',
  },
  {
    id: 'departments',
    title: 'Departments & clinics',
    description: 'Clinical departments, specialist clinics, and facility assignment.',
    category: 'Clinical configuration',
    icon: <Stethoscope className="h-6 w-6" />,
    keywords: ['departments', 'clinics', 'specialist', 'internal medicine'],
    help: 'Departments and clinics flow into OPD, appointments, and reporting.',
  },
  {
    id: 'clinical',
    title: 'Clinical catalog',
    description: 'Visit types, payment methods, identifiers, and triage defaults.',
    category: 'Clinical configuration',
    icon: <ClipboardList className="h-6 w-6" />,
    keywords: ['visit', 'payment', 'identifier', 'triage', 'catalog'],
    help: 'Dropdown values across registration and outpatient workflows.',
  },
  {
    id: 'wards',
    title: 'Wards & beds',
    description: 'Inpatient units, bed inventory, and occupancy configuration.',
    category: 'Facilities',
    icon: <Heart className="h-6 w-6" />,
    keywords: ['wards', 'beds', 'ipd', 'admission', 'occupancy'],
    help: 'New wards appear in admissions, transfers, and bed reports immediately.',
  },
  {
    id: 'laboratory',
    title: 'Laboratory catalog',
    description: 'Panels, tests, sample types, and turnaround configuration.',
    category: 'Service catalogs',
    icon: <FlaskConical className="h-6 w-6" />,
    keywords: ['lab', 'tests', 'panels', 'samples'],
    help: 'Tests become orderable from consultations and appear in the lab worklist.',
  },
  {
    id: 'radiology',
    title: 'Radiology catalog',
    description: 'Modalities, study types, and imaging service configuration.',
    category: 'Service catalogs',
    icon: <Scan className="h-6 w-6" />,
    keywords: ['radiology', 'xray', 'ct', 'mri', 'ultrasound'],
    help: 'Modalities flow to radiology requests and reporting templates.',
  },
  {
    id: 'theatre',
    title: 'Theatre configuration',
    description: 'Operating theatres, procedures, and surgical service setup.',
    category: 'Service catalogs',
    icon: <Activity className="h-6 w-6" />,
    keywords: ['theatre', 'surgery', 'procedures', 'or'],
    help: 'Theatres and procedures appear in surgical scheduling workspaces.',
  },
  {
    id: 'maternity',
    title: 'Maternity configuration',
    description: 'ANC templates, delivery types, and maternity service setup.',
    category: 'Service catalogs',
    icon: <Heart className="h-6 w-6" />,
    keywords: ['maternity', 'anc', 'labour', 'delivery'],
    help: 'Maternity catalog values drive ANC and delivery documentation.',
  },
  {
    id: 'hospital-docs',
    title: 'Hospital document library',
    description: 'Publish policies, SOPs, forms, and circulars for all departments.',
    category: 'Documents & printing',
    icon: <FileText className="h-6 w-6" />,
    keywords: ['hospital', 'policy', 'sop', 'circular', 'library', 'publish'],
    help: 'Staff access published files from the Hospital Library in the main navigation.',
  },
  {
    id: 'templates',
    title: 'Document templates',
    description: 'Printable clinical documents with variables and hospital letterhead.',
    category: 'Documents & printing',
    icon: <FileText className="h-6 w-6" />,
    keywords: ['templates', 'discharge', 'referral', 'sick sheet', 'consent'],
    help: 'One template update applies to sick sheets, referrals, and future PDFs.',
  },
  {
    id: 'printing',
    title: 'Printing & QR',
    description: 'Patient cards, QR codes, and print layout defaults.',
    category: 'Documents & printing',
    icon: <Printer className="h-6 w-6" />,
    keywords: ['print', 'qr', 'patient card', 'barcode'],
    help: 'Branding from the hospital profile is applied to all printable outputs.',
  },
  {
    id: 'branding',
    title: 'Branding & theme',
    description: 'Logo, colors, favicon, stamp, and global visual identity.',
    category: 'Documents & printing',
    icon: <Palette className="h-6 w-6" />,
    keywords: ['logo', 'color', 'brand', 'favicon', 'theme'],
    help: 'Logo changes update login, navigation, patient cards, and PDF letterhead.',
  },
  {
    id: 'notifications',
    title: 'Notification center',
    description: 'SMS sender, templates, alerts, and delivery configuration.',
    category: 'Communications',
    icon: <Bell className="h-6 w-6" />,
    keywords: ['sms', 'email', 'alerts', 'notifications'],
    help: 'Configure how staff and patients receive system alerts.',
  },
  {
    id: 'reporting',
    title: 'Reports',
    description: 'Operational and clinical reporting center.',
    category: 'Reports',
    icon: <ClipboardList className="h-6 w-6" />,
    keywords: ['reports', 'moh', 'csv', 'analytics'],
    help: 'Run hospital reports using live configuration and clinical data.',
  },
  {
    id: 'audit',
    title: 'Audit logs',
    description: 'Compliance trail of user actions and record changes.',
    category: 'Governance',
    icon: <Shield className="h-6 w-6" />,
    keywords: ['audit', 'compliance', 'trail', 'history'],
    help: 'Review who changed what and when across the hospital system.',
  },
  {
    id: 'security',
    title: 'Security',
    description: 'Role guidelines, access policies, and security reference.',
    category: 'Governance',
    icon: <Shield className="h-6 w-6" />,
    keywords: ['security', 'policy', 'guidelines', 'reception', 'doctor'],
    help: 'Reference for how each role should and should not use the system.',
  },
  {
    id: 'backup',
    title: 'Backup & restore',
    description: 'Database backup commands and recovery procedures.',
    category: 'Operations',
    icon: <HardDrive className="h-6 w-6" />,
    keywords: ['backup', 'restore', 'database', 'disaster'],
    help: 'Operational scripts for protecting hospital data.',
  },
  {
    id: 'system',
    title: 'System health',
    description: 'Database, storage, queue, and runtime operational status.',
    category: 'Operations',
    icon: <Settings className="h-6 w-6" />,
    keywords: ['health', 'database', 'redis', 'storage', 'status'],
    help: 'Live view of platform services and usage indicators.',
  },
  {
    id: 'superadmin',
    title: 'Super admin',
    description: 'Advanced operations, deployment checks, and platform tools.',
    category: 'Operations',
    icon: <Settings className="h-6 w-6" />,
    keywords: ['super', 'ops', 'deployment', 'platform'],
    help: 'For platform operators — not routine hospital administration.',
  },
]

export function findControlCenterCard(id: ControlCenterSection) {
  return controlCenterCards.find((card) => card.id === id)
}

export function filterControlCenterCards(query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return controlCenterCards
  return controlCenterCards.filter(
    (card) =>
      card.title.toLowerCase().includes(q) ||
      card.description.toLowerCase().includes(q) ||
      card.category.toLowerCase().includes(q) ||
      card.keywords.some((k) => k.includes(q)),
  )
}

export const controlCenterCategories = Array.from(
  new Set(controlCenterCards.map((card) => card.category)),
)
