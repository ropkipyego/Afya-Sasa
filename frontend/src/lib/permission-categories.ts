export type PermissionRow = {
  id: string
  permissionKey: string
  description?: string | null
  resource?: string
  action?: string
}

export const RESOURCE_LABELS: Record<string, string> = {
  patients: 'Patients',
  encounters: 'OPD / encounters',
  consultations: 'Consultations',
  triage: 'Triage',
  appointments: 'Appointments',
  referrals: 'Referrals',
  sick_sheets: 'Sick sheets',
  worklists: 'Queues / worklists',
  lab_catalogue: 'Laboratory catalogue',
  lab_requests: 'Laboratory requests',
  lab_samples: 'Laboratory samples',
  lab_results: 'Laboratory results',
  lab_attachments: 'Laboratory files',
  radiology_requests: 'Radiology',
  pharmacy: 'Pharmacy',
  inventory: 'Inventory & store',
  payments: 'Finance / cashier',
  admissions: 'Inpatient',
  wards: 'Wards',
  beds: 'Beds',
  icu_admissions: 'ICU',
  hdu_admissions: 'HDU',
  emergency: 'Emergency',
  pregnancies: 'Maternity',
  surgery_bookings: 'Theatre',
  vitals: 'Nursing / vitals',
  marketing: 'Marketing',
  reports: 'Reports',
  exports: 'Exports',
  users: 'Users',
  roles: 'Roles',
  departments: 'Departments',
  settings: 'Hospital settings',
  audit_logs: 'Audit',
  hospital_documents: 'Hospital library',
  platform: 'Platform',
}

export function permissionResource(permission: PermissionRow) {
  if (permission.resource?.trim()) return permission.resource.trim()
  return permission.permissionKey.split(':')[0] || 'other'
}

export function resourceLabel(resource: string) {
  return RESOURCE_LABELS[resource] ?? resource.replace(/_/g, ' ')
}

export function groupPermissionsByResource(permissions: PermissionRow[]) {
  const groups = new Map<string, PermissionRow[]>()
  for (const permission of permissions) {
    const resource = permissionResource(permission)
    const bucket = groups.get(resource) ?? []
    bucket.push(permission)
    groups.set(resource, bucket)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => resourceLabel(a).localeCompare(resourceLabel(b)))
    .map(([resource, rows]) => ({
      resource,
      label: resourceLabel(resource),
      permissions: rows.slice().sort((a, b) => a.permissionKey.localeCompare(b.permissionKey)),
    }))
}
