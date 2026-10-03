const DIRECTOR_FINANCE_ROLES = ['director', 'administrator', 'superadmin'];
const DIRECTOR_FINANCE_PERMISSIONS = ['payments:read', 'settings:manage'];

export function canViewDirectorFinance(user?: {
  roles?: string[];
  permissions?: string[];
}): boolean {
  const roles = user?.roles ?? [];
  const permissions = user?.permissions ?? [];
  if (roles.some((role) => DIRECTOR_FINANCE_ROLES.includes(role.toLowerCase()))) {
    return true;
  }
  return permissions.some((permission) => DIRECTOR_FINANCE_PERMISSIONS.includes(permission));
}
