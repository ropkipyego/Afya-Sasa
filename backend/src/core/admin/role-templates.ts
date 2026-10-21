export type RoleTemplate = {
  name: string
  label: string
  description: string
  permissionKeys: string[]
}

export const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    name: 'records_officer',
    label: 'Receptionist / Records Officer',
    description: 'Register patients, appointments, and check-in. No clinical result release.',
    permissionKeys: [
      'patients:create',
      'patients:read',
      'patients:search',
      'patients:update',
      'encounters:create',
      'encounters:read',
      'appointments:read',
      'appointments:create',
      'worklists:read',
    ],
  },
  {
    name: 'doctor',
    label: 'Doctor',
    description: 'Consultations, orders, and viewing results. Does not collect cash.',
    permissionKeys: [
      'patients:read',
      'patients:history',
      'consultations:read',
      'consultations:create',
      'encounters:read',
      'lab_requests:create',
      'lab_requests:read',
      'radiology_requests:create',
      'radiology_requests:read',
      'pharmacy:read',
      'admissions:read',
      'worklists:read',
    ],
  },
  {
    name: 'nurse',
    label: 'Nurse',
    description: 'Triage, vitals, and ward observations.',
    permissionKeys: [
      'patients:read',
      'triage:read',
      'triage:create',
      'vitals:read',
      'vitals:create',
      'admissions:read',
      'encounters:read',
      'worklists:read',
    ],
  },
  {
    name: 'lab_technician',
    label: 'Laboratory Technician',
    description: 'Specimen handling and result entry. Cannot verify or amend verified results.',
    permissionKeys: [
      'lab_requests:read',
      'lab_samples:read',
      'lab_samples:update',
      'lab_results:create',
      'lab_results:read',
      'worklists:read',
    ],
  },
  {
    name: 'lab_verifier',
    label: 'Laboratory Verifier',
    description: 'Verify and release laboratory reports.',
    permissionKeys: [
      'lab_requests:read',
      'lab_results:read',
      'lab_results:verify',
      'lab_results:update',
      'worklists:read',
    ],
  },
  {
    name: 'radiology_technician',
    label: 'Radiology Technician',
    description: 'Imaging worklist and reporting.',
    permissionKeys: ['radiology_requests:read', 'radiology_requests:update', 'worklists:read'],
  },
  {
    name: 'pharmacist',
    label: 'Pharmacist',
    description: 'Dispense and pharmacy stock. Does not run main-store procurement.',
    permissionKeys: [
      'pharmacy:read',
      'pharmacy:dispense',
      'inventory:read',
      'patients:read',
      'worklists:read',
    ],
  },
  {
    name: 'store_officer',
    label: 'Store / Procurement Officer',
    description: 'Main store, requisitions, receiving, and stock take.',
    permissionKeys: ['inventory:read', 'inventory:manage', 'inventory:create', 'inventory:update'],
  },
  {
    name: 'cashier',
    label: 'Cashier',
    description: 'Collect payments and reprint receipts. Refunds need payments:manage.',
    permissionKeys: ['payments:initiate', 'payments:read', 'patients:read', 'patients:search'],
  },
  {
    name: 'insurance_officer',
    label: 'Insurance / Claims Officer',
    description:
      'Eligibility, operational claim drafts, and portal-number recording. Remittance (partially_paid/settled) and cashier collections stay on payments:manage / payments:initiate. SHA portal remains the claim system.',
    permissionKeys: ['patients:read', 'payments:read', 'encounters:read'],
  },
  {
    name: 'department_head',
    label: 'Department Head',
    description: 'Department operational reports plus own clinical read access.',
    permissionKeys: ['reports:read', 'worklists:read', 'patients:read', 'encounters:read'],
  },
  {
    name: 'director',
    label: 'Director',
    description: 'Hospital operational intelligence. Not a general-ledger role.',
    permissionKeys: ['reports:read', 'worklists:read'],
  },
  {
    name: 'hospital_administrator',
    label: 'Hospital Administrator',
    description: 'Users, departments, catalogues, and hospital settings. Not platform superadmin.',
    permissionKeys: [
      'settings:manage',
      'users:manage',
      'roles:manage',
      'departments:manage',
      'audit_logs:read',
      'hospital_documents:read',
    ],
  },
  {
    name: 'it_support',
    label: 'IT Support',
    description: 'System health, email/SMS status, and audit review. Cannot restore production.',
    permissionKeys: ['settings:manage', 'audit_logs:read'],
  },
]

export function filterTemplateKeys(available: Set<string>, keys: string[]) {
  return keys.filter((key) => available.has(key))
}
