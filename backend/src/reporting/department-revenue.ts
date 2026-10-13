import { canViewDirectorFinance } from '../common/errors/director-access';

export const DEPARTMENT_SERVICE_LINES = [
  'consultation',
  'pharmacy',
  'laboratory',
  'radiology',
  'inpatient',
  'other',
] as const;

export type DepartmentServiceLine = (typeof DEPARTMENT_SERVICE_LINES)[number];

const LINE_PERMISSIONS: Record<DepartmentServiceLine, string[]> = {
  consultation: ['consultations:read', 'encounters:create'],
  pharmacy: ['pharmacy:read', 'inventory:read'],
  laboratory: ['lab_requests:read'],
  radiology: ['radiology_requests:read'],
  inpatient: ['admissions:read', 'icu_admissions:read', 'hdu_admissions:read'],
  other: ['surgery_bookings:read', 'pregnancies:read', 'emergency:read'],
};

export function visibleServiceLines(user?: {
  roles?: string[];
  permissions?: string[];
}): DepartmentServiceLine[] | 'all' {
  if (canViewDirectorFinance(user)) return 'all';
  const permissions = user?.permissions ?? [];
  if (permissions.includes('payments:read') || permissions.includes('payments:initiate')) {
    return 'all';
  }
  const lines = DEPARTMENT_SERVICE_LINES.filter((line) =>
    LINE_PERMISSIONS[line].some((permission) => permissions.includes(permission)),
  );
  return lines;
}

export function pickServiceLineTotals(
  totals: Record<string, number>,
  visible: DepartmentServiceLine[] | 'all',
) {
  if (visible === 'all') return { ...totals };
  return Object.fromEntries(
    Object.entries(totals).filter(([key]) => visible.includes(key as DepartmentServiceLine)),
  );
}
