import type { ControlCenterSection } from '../components/admin/HospitalControlCenter'

const sectionPermissions: Partial<Record<Exclude<ControlCenterSection, 'home'>, string>> = {
  users: 'users:manage',
  roles: 'roles:manage',
  departments: 'departments:manage',
  audit: 'audit_logs:read',
  superadmin: 'settings:manage',
}

const defaultPermission = 'settings:manage'

export function permissionForControlCenterSection(
  section: Exclude<ControlCenterSection, 'home'>,
): string {
  return sectionPermissions[section] ?? defaultPermission
}

export function canAccessControlCenterSection(
  permissions: string[],
  section: Exclude<ControlCenterSection, 'home'>,
): boolean {
  return permissions.includes(permissionForControlCenterSection(section))
}
