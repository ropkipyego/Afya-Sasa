/** System role slugs stored in demo.roles.name */
export const SUPERADMIN_ROLE_NAME = 'superadmin';
export const ADMINISTRATOR_ROLE_NAME = 'administrator';

/** Platform-level permission keys (superadmin only after migration). */
export const PLATFORM_SUPERADMIN_PERMISSION = 'platform:superadmin';
export const PLATFORM_TENANTS_PERMISSION = 'platform:tenants';

/** Core hospital-admin permissions that only superadmin may change on system roles. */
export const PROTECTED_ADMIN_PERMISSION_KEYS = [
  'users:manage',
  'roles:manage',
  'settings:manage',
  'audit_logs:read',
  'departments:manage',
  PLATFORM_TENANTS_PERMISSION,
  PLATFORM_SUPERADMIN_PERMISSION,
] as const;

export const SYSTEM_ROLE_NAMES = new Set([
  SUPERADMIN_ROLE_NAME,
  ADMINISTRATOR_ROLE_NAME,
  'doctor',
  'nurse',
  'lab_technician',
  'radiology_technician',
  'records_officer',
]);

/** Seed platform owner — stable id from InitialPhaseOne migration. */
export const SEED_PLATFORM_OWNER_USER_ID = '20000000-0000-4000-8000-000000000001';
