/**
 * Clinical reference numbers for Jalaram Hospital (and other single-facility deploys).
 * Override with HOSPITAL_NUMBER_PREFIX (default JH).
 */
export function hospitalNumberPrefix(): string {
  const raw = process.env.HOSPITAL_NUMBER_PREFIX?.trim();
  return (raw && raw.length > 0 ? raw : 'JH').toUpperCase();
}

export type HospitalNumberKind =
  | 'patient'
  | 'opd'
  | 'ipd'
  | 'adm'
  | 'ed'
  | 'lab'
  | 'rad'
  | 'smp'
  | 'preg';

export function formatHospitalNumber(
  kind: HospitalNumberKind,
  sequence: number,
  year = new Date().getFullYear(),
): string {
  const prefix = hospitalNumberPrefix();
  const width = kind === 'smp' ? 6 : 5;
  const seq = String(Math.max(1, sequence)).padStart(width, '0');

  switch (kind) {
    case 'patient':
      return `${prefix}-${year}-${seq}`;
    case 'opd':
      return `${prefix}-OPD-${year}-${seq}`;
    case 'ipd':
      return `${prefix}-IPD-${year}-${seq}`;
    case 'adm':
      return `${prefix}-ADM-${year}-${seq}`;
    case 'ed':
      return `${prefix}-ED-${year}-${seq}`;
    case 'lab':
      return `${prefix}-LAB-${year}-${seq}`;
    case 'rad':
      return `${prefix}-RAD-${year}-${seq}`;
    case 'smp':
      return `${prefix}-SMP-${year}-${seq}`;
    case 'preg':
      return `${prefix}-PREG-${year}-${seq}`;
    default:
      return `${prefix}-${year}-${seq}`;
  }
}

/** SQL LIKE pattern for counting existing numbers in the current year (avoids cross-year drift). */
export function hospitalNumberLikePattern(
  kind: HospitalNumberKind,
  year = new Date().getFullYear(),
): string {
  const prefix = hospitalNumberPrefix();
  switch (kind) {
    case 'patient':
      return `${prefix}-${year}-%`;
    case 'opd':
      return `${prefix}-OPD-${year}-%`;
    case 'ipd':
      return `${prefix}-IPD-${year}-%`;
    case 'adm':
      return `${prefix}-ADM-${year}-%`;
    case 'ed':
      return `${prefix}-ED-${year}-%`;
    case 'lab':
      return `${prefix}-LAB-${year}-%`;
    case 'rad':
      return `${prefix}-RAD-${year}-%`;
    case 'smp':
      return `${prefix}-SMP-${year}-%`;
    case 'preg':
      return `${prefix}-PREG-${year}-%`;
    default:
      return `${prefix}-${year}-%`;
  }
}
