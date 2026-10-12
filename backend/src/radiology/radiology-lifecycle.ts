export const RADIOLOGY_STATUSES = [
  'requested',
  'scheduled',
  'in_progress',
  'reported',
  'verified',
  'cancelled',
] as const;

export type RadiologyStatus = (typeof RADIOLOGY_STATUSES)[number];

const ALLOWED: Record<RadiologyStatus, RadiologyStatus[]> = {
  requested: ['scheduled', 'in_progress', 'cancelled'],
  scheduled: ['in_progress', 'cancelled'],
  in_progress: ['reported', 'cancelled'],
  reported: ['verified'],
  verified: [],
  cancelled: [],
};

export function canTransitionRadiology(from: RadiologyStatus, to: RadiologyStatus): boolean {
  if (from === to) return true;
  return ALLOWED[from]?.includes(to) === true;
}

export function radiologyReportIsLocked(verifiedAt: Date | string | null | undefined): boolean {
  return Boolean(verifiedAt);
}
