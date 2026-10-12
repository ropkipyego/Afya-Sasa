/**
 * Laboratory access rules using existing identity fields only.
 *
 * Hospital `user_departments` point at `demo.departments` (clinics/wards).
 * Catalogue `lab_departments` (HEM/CC/SER) live on orderable tests.
 * Encounters store free-text `department_name`. JWTs do not include department ids.
 * Those three sources cannot be joined without inventing a mapping, so department
 * scope is not implemented. Report HTML is fail-closed instead of hospital-wide.
 */
export type LabAccessUser = {
  sub?: string;
  roles?: string[];
  permissions?: string[];
};

export function hasLabPermission(user: LabAccessUser | undefined, key: string) {
  return (user?.permissions ?? []).includes(key);
}

export function isPrivilegedAdmin(user: LabAccessUser | undefined) {
  const roles = user?.roles ?? [];
  return roles.includes('administrator') || roles.includes('superadmin');
}

export function canAccessStructuredLabReport(
  user: LabAccessUser | undefined,
  request: { createdBy?: string | null },
): boolean {
  if (!hasLabPermission(user, 'lab_results:read')) return false;
  if (isPrivilegedAdmin(user)) return true;
  if (hasLabPermission(user, 'lab_results:verify')) return true;
  if (user?.sub && request.createdBy && user.sub === request.createdBy) return true;
  return false;
}

export function canCancelLabRequest(user: LabAccessUser | undefined) {
  return hasLabPermission(user, 'lab_requests:cancel');
}

export function canAmendLabResult(user: LabAccessUser | undefined) {
  return hasLabPermission(user, 'lab_results:amend');
}
