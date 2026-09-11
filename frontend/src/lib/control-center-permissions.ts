import type { ControlCenterSection } from '../components/admin/HospitalControlCenter'

const sectionPermissions: Partial<Record<Exclude<ControlCenterSection, 'home'>, string>> = {
  users: 'users:manage',
  roles: 'roles:manage',
  departments: 'departments:manage',
  audit: 'audit_logs:read',
  superadmin: 'platform:superadmin',
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
  if (section === 'superadmin') {
    return (
      permissions.includes('platform:superadmin') ||
      permissions.includes('platform:tenants')
    )
  }
  if (section === 'wards') {
    return permissions.includes('wards:manage') || permissions.includes('beds:manage')
  }
  const required = permissionForControlCenterSection(section)
  return permissions.includes(required)
}
