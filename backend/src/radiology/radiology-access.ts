export type RadiologyAccessUser = {
  sub?: string;
  roles?: string[];
  permissions?: string[];
};

export function hasRadiologyPermission(user: RadiologyAccessUser | undefined, key: string) {
  return (user?.permissions ?? []).includes(key);
}

export function isPrivilegedAdmin(user: RadiologyAccessUser | undefined) {
  const roles = user?.roles ?? [];
  return roles.includes('administrator') || roles.includes('superadmin');
}

export function canAccessRadiologyReportContent(
  user: RadiologyAccessUser | undefined,
  request: { createdBy?: string | null },
): boolean {
  if (isPrivilegedAdmin(user)) return true;
  if (hasRadiologyPermission(user, 'radiology_reports:verify')) return true;
  if (hasRadiologyPermission(user, 'radiology_reports:read')) return true;
  if (user?.sub && request.createdBy && user.sub === request.createdBy) return true;
  return false;
}

export function redactRadiologyAttachment<T extends { storagePath?: string; filename?: string }>(
  attachment: T,
) {
  return {
    ...attachment,
    storagePath: undefined,
    filename: attachment.filename ? 'redacted' : attachment.filename,
    redacted: true as const,
  };
}
